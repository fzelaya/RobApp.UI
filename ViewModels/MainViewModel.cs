using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using System;
using System.IO;
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
            if (dlg.ShowDialog() == true) SelectedWordPath = dlg.FileName;
        }

        [RelayCommand]
        private void SelectExcel()
        {
            var dlg = new OpenFileDialog { Filter = "Excel files (*.xlsx)|*.xlsx" };
            if (dlg.ShowDialog() == true) SelectedExcelPath = dlg.FileName;
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