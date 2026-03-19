#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow,
};

const TOP_OFFSET: i32 = 12;
const RIGHT_OFFSET: i32 = 14;
const WINDOW_WIDTH: u32 = 430;
const MAX_WINDOW_HEIGHT: u32 = 600;
const MINI_WINDOW_HEIGHT: u32 = 224;
const MINI_WINDOW_HEIGHT_WITH_FEEDBACK: u32 = 264;

fn position_window_top_right(window: &WebviewWindow) {
  let monitor = match window.current_monitor() {
    Ok(Some(value)) => value,
    _ => return,
  };
  let size = match window.outer_size() {
    Ok(value) => value,
    Err(_) => return,
  };

  // Use work area to avoid overlapping macOS menu bar / dock.
  let work_area = monitor.work_area();
  let x = work_area.position.x + work_area.size.width as i32 - size.width as i32 - RIGHT_OFFSET;
  let y = work_area.position.y + TOP_OFFSET;

  let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
}

fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

fn toggle_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let is_visible = window.is_visible().unwrap_or(false);
    if is_visible {
      let _ = window.hide();
      return;
    }
    let _ = window.show();
    let _ = window.set_focus();
  }
}

#[tauri::command]
fn set_window_mode(app: AppHandle, mode: String, height: Option<u32>) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  let target_height = if mode == "mini" {
    height
      .unwrap_or(MINI_WINDOW_HEIGHT)
      .clamp(MINI_WINDOW_HEIGHT, MINI_WINDOW_HEIGHT_WITH_FEEDBACK)
  } else {
    MAX_WINDOW_HEIGHT
  };

  window
    .set_size(Size::Logical(LogicalSize::new(
      WINDOW_WIDTH as f64,
      target_height as f64,
    )))
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  window.hide().map_err(|error| error.to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![set_window_mode, hide_main_window])
    .setup(|app| {
      let open = MenuItemBuilder::with_id("open", "대시보드 열기").build(app)?;
      let quit = MenuItemBuilder::with_id("quit", "종료").build(app)?;
      let menu = MenuBuilder::new(app).items(&[&open, &quit]).build()?;
      if let Some(window) = app.get_webview_window("main") {
        position_window_top_right(&window);
        let _ = window.hide();
      }

      let default_icon = app.default_window_icon().cloned();
      let mut tray_builder = TrayIconBuilder::new().menu(&menu);
      if let Some(icon) = default_icon {
        tray_builder = tray_builder.icon(icon);
      }

      tray_builder
        .on_menu_event(|app, event| match event.id.as_ref() {
          "open" => {
            show_main_window(app);
          }
          "quit" => {
            app.exit(0);
          }
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            toggle_main_window(&tray.app_handle());
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
