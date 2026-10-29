import html2canvas from 'html2canvas';

export interface CaptureOptions {
  fileName?: string;
  scale?: number;
  backgroundColor?: string;
}

/**
 * Captures an HTML element as an HTMLCanvasElement with 2x retina sharpness
 * and unwraps any scrollable containers (overflow-x-auto) so the whole
 * table / document is fully visible in the resulting image.
 *
 * Fully supports Tailwind CSS v4 colors (oklch) via our native color parser patch.
 */
export async function captureElementToCanvas(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  const scale = options.scale || 2;
  const backgroundColor = options.backgroundColor || '#ffffff';

  // Measure actual scroll width to avoid any horizontal truncation
  const scrollWidth = Math.max(element.scrollWidth, 1200);

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor,
    useCORS: true,
    allowTaint: true,
    logging: false,
    windowWidth: scrollWidth,
    onclone: (_clonedDoc, clonedElement) => {
      // 1. Completely disable all CSS animations and transitions so elements are not captured mid-fade
      const allNodes = clonedElement.querySelectorAll<HTMLElement>('*');
      allNodes.forEach(el => {
        el.style.animation = 'none';
        el.style.transition = 'none';
      });

      // 2. Hide any buttons or controls marked with no-screenshot or no-print
      const hiddenElements = clonedElement.querySelectorAll<HTMLElement>(
        '.no-screenshot, .no-print, [data-no-screenshot="true"]'
      );
      hiddenElements.forEach(el => {
        el.style.display = 'none';
      });

      // 3. Expand all scrollable containers so horizontal tables aren't clipped
      const scrollables = clonedElement.querySelectorAll<HTMLElement>(
        '.overflow-x-auto, .overflow-y-auto, [class*="overflow-"]'
      );
      scrollables.forEach(el => {
        el.style.overflow = 'visible';
        el.style.maxWidth = 'none';
        el.style.width = '100%';
      });

      // 4. Ensure table cells and badges maintain strict vertical centering
      const tableCells = clonedElement.querySelectorAll<HTMLElement>('td, th');
      tableCells.forEach(cell => {
        cell.style.verticalAlign = 'middle';
      });

      const tableBadges = clonedElement.querySelectorAll<HTMLElement>('td button, td span');
      tableBadges.forEach(el => {
        el.style.boxSizing = 'border-box';
        el.style.verticalAlign = 'middle';
        el.style.opacity = '1';
        el.style.visibility = 'visible';
      });

      // 6. Ensure main cloned container has full auto width and clean presentation
      clonedElement.style.width = 'max-content';
      clonedElement.style.minWidth = '100%';
      clonedElement.style.maxWidth = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.boxShadow = 'none';
    },
  });

  return canvas;
}

/**
 * Downloads a canvas directly as a PNG image file
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const cleanName = filename.endsWith('.png') ? filename : `${filename}.png`;
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.download = cleanName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copies the canvas image directly into the user's system clipboard
 * so they can immediately paste (Ctrl+V) into WhatsApp, Telegram, Word, etc.
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }

      try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          resolve(true);
          return;
        }
      } catch (err) {
        console.warn('ClipboardItem write failed or blocked:', err);
      }

      resolve(false);
    }, 'image/png', 1.0);
  });
}
