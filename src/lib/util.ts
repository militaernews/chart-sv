import html2canvas from 'html2canvas-pro';

export function formatTime(time: Date | string | null) {
	if (!time) return '';

	if (typeof time === 'string') {
		const [hours, minutes] = time.split(':');
		return `${hours}:${minutes}`;
	}

	const hours = time.getHours().toString().padStart(2, '0');
	const minutes = time.getMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}`;
}

export function formatDate(date: Date | null | string) {
	if (!date) return 'No expiry';
	return new Date(date).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}




export async function captureScreenshot2(): Promise<void> {
	try {
		// Get the main container
		const container = document.querySelector('#container') as HTMLElement;

		if (!container) {
			throw new Error('Container not found');
		}

		// Create a temporary style to fix oklch colors for html2canvas

		// Add temp class
		container.classList.add('temp-screenshot');

		const canvas = await html2canvas(container, {
			useCORS: true,
			allowTaint: true,
			scale: 2,
			logging: true,
			backgroundColor: '#ffffff',
			ignoreElements: (element) => {
				return (
					element.classList.contains('dropdown-content') ||
					element.classList.contains('modal') ||
					element.classList.contains('navbar')
				);
			}
		});

		// Clean up
		container.classList.remove('temp-screenshot');
		document.head.removeChild(style);

		// Download the screenshot
		canvas.toBlob((blob) => {
			if (blob) {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `map-screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}
		}, 'image/png');
	} catch (error) {
		console.error('html2canvas failed:', error);
		alert("Screenshot capture failed. Please try using your browser's built-in screenshot tools.");
		throw error;
	}
}
