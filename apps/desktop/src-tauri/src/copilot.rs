//! Thin authenticated proxy to the Anthropic Messages API (docs/AI_WORKFLOWS.md).
//!
//! F7 — key custody is native. The Anthropic API key lives in the OS keychain
//! (macOS Keychain / Windows Credential Manager / Linux secret-service), read by
//! the Rust process at call time. The webview never stores the key (only a
//! boolean "is one set"), never persists it to PGlite, and never passes it over
//! IPC after the one-time entry. Native HTTP also sidesteps CORS. Raw HTTP —
//! there is no first-party Rust Anthropic SDK.

use keyring::Entry;

const KEYCHAIN_SERVICE: &str = "com.mainspring.app";
const KEYCHAIN_ACCOUNT: &str = "anthropic_api_key";

fn entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())
}

/// Store the API key in the OS keychain (the only time it crosses IPC).
#[tauri::command]
pub fn set_anthropic_key(key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("empty API key".into());
    }
    entry()?.set_password(key.trim()).map_err(|e| e.to_string())
}

/// Whether a key is set — the only key-related fact the webview learns.
#[tauri::command]
pub fn has_anthropic_key() -> bool {
    matches!(entry().and_then(|e| e.get_password().map_err(|e| e.to_string())), Ok(_))
}

/// Forget the stored key.
#[tauri::command]
pub fn clear_anthropic_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// POST a pre-built Messages API request body. Reads the key from the keychain
/// itself — the webview never sends it.
#[tauri::command]
pub async fn anthropic_message(body: String) -> Result<String, String> {
    let api_key = entry()?
        .get_password()
        .map_err(|_| "No Anthropic API key set. Add one in the Almanac.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = ureq::post("https://api.anthropic.com/v1/messages")
            .set("x-api-key", &api_key)
            .set("anthropic-version", "2023-06-01")
            .set("content-type", "application/json")
            .send_string(&body);
        match result {
            Ok(resp) => resp.into_string().map_err(|e| e.to_string()),
            Err(ureq::Error::Status(code, resp)) => Err(format!(
                "HTTP {code}: {}",
                resp.into_string().unwrap_or_default()
            )),
            Err(e) => Err(e.to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
