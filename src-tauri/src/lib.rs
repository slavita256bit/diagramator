mod commands;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's DMA-BUF renderer crashes on some Wayland/NVIDIA setups with
    // "Error 71 (Protocol error) dispatching to Wayland display". Disabling it costs a lot
    // of rendering performance (laggy canvas), so only do it on NVIDIA or when asked via
    // `DIAGRAMATOR_DISABLE_DMABUF=1`. An explicit WEBKIT_DISABLE_DMABUF_RENDERER always wins.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
        && (std::path::Path::new("/proc/driver/nvidia").exists()
            || std::env::var_os("DIAGRAMATOR_DISABLE_DMABUF").is_some_and(|v| v == "1"))
    {
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
            commands::save_project,
            commands::list_examples,
            commands::prepare_example,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Diagramator");
}
