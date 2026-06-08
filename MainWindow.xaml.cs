using System.Windows;
using RobApp.UI.ViewModels;
using RobApp.UI.Services; 
namespace RobApp.UI
{
	public partial class MainWindow : Window
	{
		public MainWindow()
		{
			InitializeComponent();
            DataContext = new RobApp.UI.ViewModels.MainViewModel();
		}
	}
}