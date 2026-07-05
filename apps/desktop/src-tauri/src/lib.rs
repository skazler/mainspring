mod copilot;
mod market;

/// Run the Monte Carlo forecast in the native Rust kernel (PREDICTION_ENGINE §2).
#[tauri::command]
fn run_forecast(params: sim::SimParams) -> sim::Forecast {
    sim::simulate(&params)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_forecast,
            market::fetch_market,
            copilot::anthropic_message,
            copilot::set_anthropic_key,
            copilot::has_anthropic_key,
            copilot::clear_anthropic_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
