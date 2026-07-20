import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

const COLOR_PRIMARIO_MENSUAL = '#691C32';
const COLOR_PRIMARIO_SEMANAL = '#235B4E';
const MODULO_ACTIVO_KEY = 'siiid_modulo_activo';

function obtenerColorPrimario(): string {
  return localStorage.getItem(MODULO_ACTIVO_KEY)?.toUpperCase() === 'SEMANAL' ? COLOR_PRIMARIO_SEMANAL : COLOR_PRIMARIO_MENSUAL;
}
const COLOR_EXITO = '#2f80d0';

interface AlertaBaseOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
}

function mostrarAlerta(
  icon: SweetAlertIcon,
  options: AlertaBaseOptions,
  confirmButtonColor = obtenerColorPrimario(),
): Promise<SweetAlertResult> {
  return Swal.fire({
    icon,
    title: options.title,
    text: options.text,
    confirmButtonText: options.confirmButtonText ?? 'OK',
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

export function confirmarAccion(
  title: string,
  text: string,
  confirmButtonText: string,
): Promise<SweetAlertResult> {
  return Swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancelar',
    confirmButtonColor: obtenerColorPrimario(),
  });
}

export function mostrarAdvertenciaHtml(title: string, html: string): Promise<SweetAlertResult> {
  return Swal.fire({
    icon: 'warning',
    title,
    html,
    confirmButtonText: 'OK',
    confirmButtonColor: obtenerColorPrimario(),
  });
}
