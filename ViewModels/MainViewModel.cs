using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using RobApp.UI.Services;

namespace RobApp.UI.ViewModels
{
    public partial class MainViewModel : ObservableObject
    {
        [ObservableProperty] private string selectedWordPath;
        [ObservableProperty] private string selectedExcelPath;
        [ObservableProperty] private String statusMessage;
        [ObservableProperty] private string log = "";

        partial void OnLogChanged(string value)
        {
            Console.WriteLine(value);
        }

        private readonly WordService _wordService;
        private readonly ExcelService _excelService;

        public MainViewModel()
        {
            _wordService = new WordService();
            _excelService = new ExcelService();
        }

        [RelayCommand]
        private void SelectWord()
        {
            var dlg = new OpenFileDialog { Filter = "Word files (*.docx)|*.docx" };
            if (dlg.ShowDialog() == true)
            {
                var validation = ValidateFile(dlg.FileName, ".docx");
                if (!validation.isValid)
                {
                    StatusMessage = validation.errorMessage;
                    return;
                }
                SelectedWordPath = dlg.FileName;
                StatusMessage = "Word file selected successfully.";
            }
        }

        [RelayCommand]
        private void SelectExcel()
        {
            var dlg = new OpenFileDialog { Filter = "Excel files (*.xlsx)|*.xlsx" };
            if (dlg.ShowDialog() == true)
            {
                var validation = ValidateFile(dlg.FileName, ".xlsx");
                if (!validation.isValid)
                {
                    StatusMessage = validation.errorMessage;
                    return;
                }
                SelectedExcelPath = dlg.FileName;
                StatusMessage = "Excel file selected successfully.";
            }
        }

        private (bool isValid, string errorMessage) ValidateFile(string filePath, string expectedExtension)
        {
            try
            {
                // Validate file exists
                if (!File.Exists(filePath))
                {
                    return (false, "File does not exist.");
                }

                // Validate file extension
                string extension = Path.GetExtension(filePath).ToLower();
                if (extension != expectedExtension)
                {
                    return (false, $"Invalid file type. Expected {expectedExtension}, got {extension}.");
                }

                // Validate file name characters (allow alphanumeric, spaces, hyphens, underscores, dots)
                string fileName = Path.GetFileName(filePath);
                if (!Regex.IsMatch(fileName, @"^[a-zA-Z0-9\s\-_.]+$"))
                {
                    return (false, "File name contains invalid characters. Use only letters, numbers, spaces, hyphens, underscores, and dots.");
                }

                return (true, "");
            }
            catch (Exception ex)
            {
                return (false, $"Error validating file: {ex.Message}");
            }
        }

        [RelayCommand]
        private async Task Process()
        {
            try
            {
                StatusMessage = "";
                if (string.IsNullOrWhiteSpace(SelectedWordPath) || string.IsNullOrWhiteSpace(SelectedExcelPath))
                {
                    StatusMessage = "Selecciona ambos archivos (.docx y .xlsx).";
                    return;
                }

                Log = $"Cargando Word: {SelectedWordPath}\n";
                var fields = await Task.Run(() => _wordService.ExtractFields(SelectedWordPath));
                Log += $"Campos extraídos: {string.Join(", ", fields.Keys)}\n";

                // Write/update Excel row
                _excelService.WriteFieldsToExcel(SelectedExcelPath, Path.GetFileName(SelectedWordPath), fields);
                Log += "Excel actualizado correctamente.\n";
                StatusMessage = "Proceso completado.";
            }
            catch (Exception ex)
            {
                StatusMessage = "Error: " + ex.Message;
                Log += "Error: " + ex + "\n";
            }
        }
    }
}