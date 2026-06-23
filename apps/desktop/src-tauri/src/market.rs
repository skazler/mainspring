//! Market-data fetch (DATA_LAYER §3). Native HTTP sidesteps browser CORS for the
//! unofficial Yahoo chart endpoint (no key, best-effort). The webview stores the
//! returned bars in PGlite and derives μ/σ locally; the simulator never live-hits.

use serde::Serialize;

#[derive(Debug, Serialize, PartialEq)]
pub struct Bar {
    /// ISO date, "YYYY-MM-DD".
    pub date: String,
    pub close: f64,
}

/// Parse the Yahoo Finance v8 chart JSON into daily close bars (nulls skipped).
pub fn parse_yahoo_chart(body: &str) -> Result<Vec<Bar>, String> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let result = &v["chart"]["result"][0];
    let timestamps = result["timestamp"]
        .as_array()
        .ok_or("missing timestamp array")?;
    let closes = result["indicators"]["quote"][0]["close"]
        .as_array()
        .ok_or("missing close array")?;

    let mut bars = Vec::with_capacity(timestamps.len());
    for (t, c) in timestamps.iter().zip(closes.iter()) {
        if let (Some(secs), Some(close)) = (t.as_i64(), c.as_f64()) {
            bars.push(Bar {
                date: unix_to_date(secs),
                close,
            });
        }
    }
    Ok(bars)
}

fn unix_to_date(secs: i64) -> String {
    let (y, m, d) = civil_from_days(secs.div_euclid(86_400));
    format!("{y:04}-{m:02}-{d:02}")
}

/// Days-since-epoch → (year, month, day). Howard Hinnant's civil algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Fetch daily history for a ticker. Blocking HTTP off the async runtime.
#[tauri::command]
pub async fn fetch_market(
    ticker: String,
    range: Option<String>,
    interval: Option<String>,
) -> Result<Vec<Bar>, String> {
    let range = range.unwrap_or_else(|| "5y".into());
    let interval = interval.unwrap_or_else(|| "1d".into());
    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={range}&interval={interval}"
    );

    tauri::async_runtime::spawn_blocking(move || {
        let body = ureq::get(&url)
            .set("User-Agent", "Mozilla/5.0 (MAINSPRING)")
            .call()
            .map_err(|e| e.to_string())?
            .into_string()
            .map_err(|e| e.to_string())?;
        parse_yahoo_chart(&body)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_epoch_to_civil_date() {
        assert_eq!(unix_to_date(0), "1970-01-01");
        assert_eq!(unix_to_date(86_400), "1970-01-02");
        assert_eq!(unix_to_date(1_700_000_000), "2023-11-14");
    }

    #[test]
    fn parses_chart_json_and_skips_nulls() {
        let json = r#"{"chart":{"result":[{
            "timestamp":[0,86400,172800],
            "indicators":{"quote":[{"close":[100.0,null,101.5]}]}
        }]}}"#;
        let bars = parse_yahoo_chart(json).unwrap();
        assert_eq!(
            bars,
            vec![
                Bar {
                    date: "1970-01-01".into(),
                    close: 100.0
                },
                Bar {
                    date: "1970-01-03".into(),
                    close: 101.5
                },
            ]
        );
    }

    #[test]
    fn errors_on_malformed_json() {
        assert!(parse_yahoo_chart("not json").is_err());
        assert!(parse_yahoo_chart("{}").is_err());
    }
}
