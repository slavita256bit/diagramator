mod commands;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's DMA-BUF renderer crashes on some Wayland/NVIDIA setups with
    // "Error 71 (Protocol error) dispatching to Wayland display".
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::analyze_project,
            commands::load_doxygen_xml,
            commands::tool_status,
            commands::read_style,
            commands::write_style,
            commands::export_typst,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Diagramator");
}
