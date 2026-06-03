import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface SafeBlobUrl {
  objectUrl: string;
  safeUrl: SafeResourceUrl;
}

export function crearSafeBlobUrl(
  blob: Blob,
  sanitizer: DomSanitizer,
  objectUrlAnterior: string | null = null,
): SafeBlobUrl {
  revocarObjectUrl(objectUrlAnterior);

  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    safeUrl: sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
  };
}

export function revocarObjectUrl(objectUrl: string | null | undefined): void {
  if (!objectUrl) {
    return;
  }

  URL.revokeObjectURL(objectUrl);
}
