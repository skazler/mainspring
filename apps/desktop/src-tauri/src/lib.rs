mod market;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

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
            greet,
            run_forecast,
            market::fetch_market
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
