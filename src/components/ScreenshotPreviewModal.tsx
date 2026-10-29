import React, { useState } from 'react';
import { X, Download, Copy, Check, ExternalLink, Image as ImageIcon, Sparkles } from 'lucide-react';
import { copyCanvasToClipboard, downloadCanvasAsPng } from '../utils/screenshotUtils';

interface ScreenshotPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: HTMLCanvasElement | null;
  title: string;
  defaultFileName: string;
}

export const ScreenshotPreviewModal: React.FC<ScreenshotPreviewModalProps> = ({
  isOpen,
  onClose,
  canvas,
  title,
  defaultFileName,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !canvas) return null;

  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const width = canvas.width;
  const height = canvas.height;

  const handleCopy = async () => {
    const ok = await copyCanvasToClipboard(canvas);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // If clipboard write is not permitted by browser, fallback to downloading
      downloadCanvasAsPng(canvas, defaultFileName);
    }
  };

  const handleDownload = () => {
    downloadCanvasAsPng(canvas, defaultFileName);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>Pratinjau Screenshot</span>
                <span className="text-[11px] px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full font-semibold">
                  HD ({width} × {height}px)
                </span>
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
              title="Salin langsung untuk ditempel di WhatsApp Web / Telegram"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin ke WA / Clipboard'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Unduh file gambar .png"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Image View */}
        <div className="p-4 sm:p-6 overflow-auto flex-1 bg-slate-100/60 flex items-center justify-center">
          <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-200/80 max-w-full inline-block">
            <img
              src={dataUrl}
              alt="Screenshot Preview"
              className="max-h-[62vh] w-auto object-contain rounded-xl select-none"
            />
          </div>
        </div>

        {/* Footer info tip */}
        <div className="px-6 py-3 border-t border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Tip Guru:</strong> Gunakan <em>Salin ke WA</em> lalu tekan <code>Ctrl + V</code> di chat WhatsApp Web orang tua/wali siswa.
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Format PNG • 2x Retina Scaling • Anti Terpotong
          </div>
        </div>
      </div>
    </div>
  );
};
