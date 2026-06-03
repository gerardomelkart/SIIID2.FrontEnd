import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

const COLOR_PRIMARIO = '#691C32';
const COLOR_EXITO = '#2f80d0';

interface AlertaBaseOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
}

function mostrarAlerta(
  icon: SweetAlertIcon,
  options: AlertaBaseOptions,
  confirmButtonColor = COLOR_PRIMARIO,
): Promise<SweetAlertResult> {
  return Swal.fire({
    icon,
    title: options.title,
    text: options.text,
    confirmButtonText: options.confirmButtonText,
    confirmButtonColor,
  });
}

export function mostrarError(
  title: string,
  text = 'Intente nuevamente.',
): Promise<SweetAlertResult> {
  return mostrarAlerta('error', { title, text });
}

export function mostrarAdvertencia(title: string, text?: string): Promise<SweetAlertResult> {
  return mostrarAlerta('warning', { title, text });
}

export function mostrarInfo(title: string, text?: string): Promise<SweetAlertResult> {
  return mostrarAlerta('info', { title, text });
}

export function mostrarExito(
  title: string,
  text?: string,
  confirmButtonText = 'OK',
): Promise<SweetAlertResult> {
  return mostrarAlerta('success', { title, text, confirmButtonText }, COLOR_EXITO);
}

export function mostrarExitoInstitucional(title: string, text?: string): Promise<SweetAlertResult> {
  return mostrarAlerta('success', { title, text });
}
