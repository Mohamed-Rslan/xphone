use crate::error::AppError;
use base64::Engine;
use std::fs;

#[tauri::command]
pub async fn save_excel_file(
    default_name: String,
    base64_content: String,
) -> Result<Option<String>, AppError> {
    let raw_bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| AppError::Internal(format!("Base64 decode error: {}", e)))?;

    // Open native Windows "Save As" file dialog
    let file_path = rfd::AsyncFileDialog::new()
        .set_file_name(&default_name)
        .set_title("حفظ التقرير (Save As)")
        .add_filter("Excel Workbook (*.xlsx)", &["xlsx"])
        .save_file()
        .await;

    match file_path {
        Some(handle) => {
            let path = handle.path().to_path_buf();
            fs::write(&path, raw_bytes)
                .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None), // User cancelled dialog
    }
}
