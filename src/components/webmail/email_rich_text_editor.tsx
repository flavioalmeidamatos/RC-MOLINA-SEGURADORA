import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMceEditor } from 'tinymce';
import tinymce from 'tinymce/tinymce';
import 'tinymce/icons/default';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/help';
import 'tinymce/plugins/image';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/media';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/table';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/wordcount';
import 'tinymce/skins/ui/oxide-dark/skin.css';
import 'tinymce/skins/content/dark/content.css';

export type EmailRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  height?: number;
  onValidationError?: (message: string) => void;
  validateFiles?: (files: File[], options?: { inlineVideo?: boolean }) => string | null;
  onFilesAdded?: (files: File[]) => void;
};

(globalThis as typeof globalThis & { tinymce?: typeof tinymce }).tinymce = tinymce;
const TinyEditor = Editor as any;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao carregar o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

function openLocalFilePicker(accept: string) {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}

function escapeAttribute(value: string) {
  return value.replace(/"/g, '&quot;');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function createVideoThumbnailDataUrl(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<string>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      const captureFrame = () => {
        const canvas = document.createElement('canvas');
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Não foi possível gerar a miniatura do video.'));
          return;
        }

        context.drawImage(video, 0, 0, width, height);
        video.pause();
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };

      video.onseeked = captureFrame;
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, (video.duration || 2) * 0.1);
      };
      video.onerror = () => reject(new Error('Falha ao carregar o video selecionado.'));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function buildVideoThumbnailMarkup(file: File) {
  const videoDataUrl = await readFileAsDataUrl(file);
  let thumbnailDataUrl = '';

  try {
    thumbnailDataUrl = await createVideoThumbnailDataUrl(file);
  } catch {
    thumbnailDataUrl = '';
  }

  const safeFileName = escapeHtml(file.name);
  const safeVideoUrl = escapeAttribute(videoDataUrl);
  const safeThumbnailUrl = escapeAttribute(thumbnailDataUrl);

  const previewContent = thumbnailDataUrl
    ? `<img src="${safeThumbnailUrl}" alt="${escapeAttribute(file.name)}" style="display:block;width:100%;max-width:640px;height:auto;border:0;" />`
    : `<span style="display:flex;align-items:center;justify-content:center;width:100%;max-width:640px;min-height:220px;background:#111827;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;">Video: ${safeFileName}</span>`;

  return `
    <p>
      <a
        href="${safeVideoUrl}"
        target="_blank"
        rel="noopener noreferrer"
        style="display:inline-block;max-width:640px;text-decoration:none;"
      >
        <span style="display:block;overflow:hidden;border:1px solid #d1d5db;border-radius:12px;background:#000000;">
          ${previewContent}
        </span>
        <span
          style="display:block;padding:10px 12px;background:#f8fafc;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;"
        >
          Assistir video: ${safeFileName}
        </span>
      </a>
    </p>
  `;
}

export function EmailRichTextEditor({
  value,
  onChange,
  disabled = false,
  height = 360,
  onValidationError,
  validateFiles,
  onFilesAdded,
}: EmailRichTextEditorProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <TinyEditor
        disabled={disabled}
        licenseKey="gpl"
        init={{
          height,
          skin: false,
          content_css: false,
          language: 'pt-BR',
          menubar: false,
          plugins: [
            'advlist',
            'autolink',
            'lists',
            'link',
            'image',
            'charmap',
            'preview',
            'anchor',
            'searchreplace',
            'visualblocks',
            'code',
            'fullscreen',
            'insertdatetime',
            'media',
            'table',
            'wordcount',
          ],
          toolbar:
            'undo redo | blocks fontfamily fontsize | bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link image localvideo table | preview code fullscreen',
          toolbar_mode: 'scrolling',
          branding: false,
          promotion: false,
          resize: false,
          elementpath: false,
          statusbar: false,
          browser_spellcheck: true,
          contextmenu: 'link image table',
          convert_urls: false,
          relative_urls: false,
          remove_script_host: false,
          paste_data_images: true,
          image_title: true,
          automatic_uploads: false,
          file_picker_types: 'image',
          file_picker_callback: async (callback, _value, meta) => {
            if (meta.filetype !== 'image') return;

            const files = await openLocalFilePicker('image/*');
            const file = files[0];
            if (!file) return;

            const dataUrl = await readFileAsDataUrl(file);
            callback(dataUrl, { title: file.name, alt: file.name });
          },
          setup: (editor: TinyMceEditor) => {
            editor.ui.registry.addButton('localvideo', {
              icon: 'embed',
              tooltip: 'Inserir miniatura clicavel de video',
              onAction: async () => {
                const files = await openLocalFilePicker('video/*');
                const file = files[0];
                if (!file) return;

                const validationMessage = validateFiles?.([file], { inlineVideo: true });
                if (validationMessage) {
                  onValidationError?.(validationMessage);
                  return;
                }

                const markup = await buildVideoThumbnailMarkup(file);
                editor.insertContent(markup);
                onFilesAdded?.([file]);
              },
            });
          },
          content_style: `
            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 14px;
              color: #222;
              line-height: 1.6;
              margin: 0;
              padding: 16px 18px;
              background: #ffffff;
            }
            p { margin: 0 0 12px; }
            table { border-collapse: collapse; width: 100%; }
            table td, table th { border: 1px solid #d0d7de; padding: 8px; }
            img { max-width: 100%; height: auto; }
            video, iframe { max-width: 100%; }
          `,
          zindex: 2200,
        }}
        onEditorChange={onChange}
        value={value}
      />
    </div>
  );
}
