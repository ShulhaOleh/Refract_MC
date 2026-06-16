//! Per-instance content management — Rust port of mods.ipc.ts (list/toggle/
//! delete/installLocal) plus the download+record half of mod installs. The
//! Modrinth/CurseForge metadata lookup stays in JS (CORS-open Modrinth, plus the
//! curseforge_* proxy commands); this module owns the filesystem + instance.json
//! writes. Pack icons (pack.png extraction) are not ported yet.

use crate::instances;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// Game dir for an instance: its external dir if set, else <instance>/minecraft.
fn game_dir(instance_id: &str) -> PathBuf {
    if let Some(inst) = instances::get_instance_by_id(instance_id.to_string()) {
        if let Some(ext) = inst.get("externalGameDir").and_then(Value::as_str) {
            if !ext.is_empty() {
                return PathBuf::from(ext);
            }
        }
    }
    instances::resolve_instance_dir(instance_id).join("minecraft")
}

fn subdir_for(kind: &str) -> &'static str {
    match kind {
        "resourcepack" => "resourcepacks",
        "shader" => "shaderpacks",
        "datapack" => "datapacks",
        _ => "mods",
    }
}

async fn download_to(url: &str, dest: &Path) -> Result<(), String> {
    let res = reqwest::get(url).await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Download failed: HTTP {}", res.status()));
    }
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if let Some(p) = dest.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    fs::write(dest, &bytes).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct ContentEntry {
    filename: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "type")]
    kind: String,
    enabled: bool,
    #[serde(rename = "sizeKb")]
    size_kb: u64,
}

fn list_dir(instance_id: &str, subdir: &str, kind: &str, exts: &[&str]) -> Vec<ContentEntry> {
    let dir = game_dir(instance_id).join(subdir);
    let mut out: Vec<ContentEntry> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for e in entries.flatten() {
            let filename = e.file_name().to_string_lossy().to_string();
            let meta = match e.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let is_dir = meta.is_dir();
            let base = filename.strip_suffix(".disabled").unwrap_or(&filename).to_string();
            let matches = exts.iter().any(|x| base.ends_with(x));
            if !is_dir && !matches {
                continue;
            }
            let enabled = !filename.ends_with(".disabled");
            let display = base.trim_end_matches(".zip").trim_end_matches(".jar").to_string();
            let size_kb = if is_dir { 0 } else { meta.len().div_ceil(1024) };
            out.push(ContentEntry { filename, display_name: display, kind: kind.to_string(), enabled, size_kb });
        }
    }
    out.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    out
}

#[tauri::command]
pub fn mods_list(instance_id: String) -> Vec<ContentEntry> {
    let mut v = list_dir(&instance_id, "mods", "mod", &[".jar"]);
    v.extend(list_dir(&instance_id, "resourcepacks", "resourcepack", &[".zip"]));
    v.extend(list_dir(&instance_id, "shaderpacks", "shader", &[".zip"]));
    v.extend(list_dir(&instance_id, "datapacks", "datapack", &[".zip"]));
    v
}

#[tauri::command]
pub fn mods_toggle(instance_id: String, filename: String, r#type: Option<String>) -> Result<(), String> {
    let dir = game_dir(&instance_id).join(subdir_for(r#type.as_deref().unwrap_or("mod")));
    let src = dir.join(&filename);
    if !src.exists() {
        return Err(format!("Not found: {filename}"));
    }
    if src.is_dir() {
        return Ok(()); // folders can't be toggled
    }
    let dst = match filename.strip_suffix(".disabled") {
        Some(base) => dir.join(base),
        None => dir.join(format!("{filename}.disabled")),
    };
    fs::rename(&src, &dst).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mods_delete(instance_id: String, filename: String, r#type: Option<String>) -> Result<(), String> {
    let dir = game_dir(&instance_id).join(subdir_for(r#type.as_deref().unwrap_or("mod")));
    let src = dir.join(&filename);
    if !src.exists() {
        return Ok(());
    }
    if src.is_dir() {
        fs::remove_dir_all(&src).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&src).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn mods_install_local(instance_id: String, src_path: String) -> Result<String, String> {
    let src = PathBuf::from(&src_path);
    let filename = src.file_name().ok_or("invalid source path")?.to_string_lossy().to_string();
    let mods_dir = game_dir(&instance_id).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
    fs::copy(&src, mods_dir.join(&filename)).map_err(|e| e.to_string())?;
    Ok(filename)
}

/// Download a mod file into the instance's mods dir and record it in
/// instance.json (prepended, deduped by projectId). The `mod` value is the
/// InstalledMod the renderer built from Modrinth/CurseForge metadata.
#[tauri::command]
pub async fn install_mod_file(instance_id: String, url: String, file_name: String, r#mod: Value) -> Result<Value, String> {
    let mods_dir = game_dir(&instance_id).join("mods");
    let safe = Path::new(&file_name).file_name().ok_or("invalid filename")?.to_string_lossy().to_string();
    download_to(&url, &mods_dir.join(&safe)).await?;

    let inst = instances::get_instance_by_id(instance_id.clone()).ok_or("instance not found")?;
    let project_id = r#mod.get("projectId").and_then(Value::as_str).unwrap_or_default().to_string();
    let mut mods: Vec<Value> = inst.get("mods").and_then(Value::as_array).cloned().unwrap_or_default();
    mods.retain(|m| m.get("projectId").and_then(Value::as_str) != Some(project_id.as_str()));
    mods.insert(0, r#mod.clone());
    instances::update_instance(instance_id, json!({ "mods": mods }))?;
    Ok(r#mod)
}

#[tauri::command]
pub fn uninstall_mod(instance_id: String, project_id: String) -> Result<(), String> {
    let inst = instances::get_instance_by_id(instance_id.clone()).ok_or("instance not found")?;
    let mods: Vec<Value> = inst.get("mods").and_then(Value::as_array).cloned().unwrap_or_default();

    if let Some(m) = mods.iter().find(|m| m.get("projectId").and_then(Value::as_str) == Some(project_id.as_str())) {
        if let Some(fname) = m.get("fileName").and_then(Value::as_str) {
            if let Some(safe) = Path::new(fname).file_name() {
                let p = game_dir(&instance_id).join("mods").join(safe);
                if p.exists() {
                    let _ = fs::remove_file(&p);
                }
            }
        }
    }

    let remaining: Vec<Value> = mods.into_iter().filter(|m| m.get("projectId").and_then(Value::as_str) != Some(project_id.as_str())).collect();
    instances::update_instance(instance_id, json!({ "mods": remaining }))?;
    Ok(())
}
