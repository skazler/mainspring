//! Thin authenticated proxy to the Anthropic Messages API (docs/AI_WORKFLOWS.md).
//!
//! The API key stays in the Rust process — the webview never holds it, and native
//! HTTP sidesteps CORS. Raw HTTP (there is no first-party Rust Anthropic SDK).
//! The webview builds the request body (model, structured-output schema, the dial
//! vocabulary + the NL request — never account balances) and parses the response.

/// POST a pre-built Messages API request body; return the raw response JSON text.
#[tauri::command]
pub async fn anthropic_message(api_key: String, body: String) -> Result<String, String> {
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
