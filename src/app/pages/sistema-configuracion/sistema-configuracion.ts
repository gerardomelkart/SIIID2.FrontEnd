import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SistemaAdministrador, SistemaAdministradores, SistemaBitacora, SistemaCambio, SistemaConfiguracion, SistemaConfiguracionService } from '../../core/services/sistema-configuracion.service';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({ selector: 'app-sistema-configuracion', imports: [FormsModule, RouterLink, DatePipe], templateUrl: './sistema-configuracion.html', styleUrl: './sistema-configuracion.css' })
export class SistemaConfiguracionPage {
  private readonly servicio = inject(SistemaConfiguracionService);
  private readonly destroy = inject(DestroyRef);
  datos = signal<SistemaConfiguracion | null>(null);
  administradores = signal<SistemaAdministradores | null>(null);
  cargandoAdministradores = signal(false);
  errorAdministradores = signal('');
  buscarUsuario = '';
  historial = signal<SistemaBitacora[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  cargandoHistorial = signal(false);
  error = signal('');
  errorHistorial = signal('');
  exito = signal('');
  cambio = signal<(SistemaCambio & { titulo: string; idUsuario?: number }) | null>(null);
  motivo = '';
  pagina = signal(1);
  constructor() { this.cargar(); this.cargarHistorial(); this.cargarAdministradores(); }
  cargar(): void {
    if (this.cargando() || this.guardando()) return;
    this.cargando.set(true); this.error.set('');
    this.servicio.obtener().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: datos => { this.datos.set(datos); this.cargando.set(false); },
      error: e => { this.cargando.set(false); this.datos.set(null); this.error.set(obtenerMensajeErrorHttp(e, 'No fue posible consultar la configuración.')); }
    });
  }
  preparar(modulo: string, clave: string, habilitado: boolean, titulo: string): void {
    const datos = this.datos();
    if (!datos || this.cargando() || this.guardando()) return;
    if (clave !== 'MODULO_ACTIVO' && !datos.opciones.some(o => o.modulo === modulo && o.clave === clave && o.disponible)) return;
    this.motivo = ''; this.exito.set(''); this.error.set('');
    this.cambio.set({ modulo, clave, habilitado, titulo, versionEsperada: datos.version, motivo: '' });
  }
  cancelar(): void { if (!this.guardando()) this.cambio.set(null); }
  motivoValido(): boolean { const texto = this.motivo.trim(); return !texto || texto.length >= 3 && texto.length <= 500; }
  activos(): number { return this.datos()?.modulos.filter(m => m.activo).length ?? 0; }
  reglasActivas(): number { return this.datos()?.opciones.filter(o => o.disponible && o.efectivo).length ?? 0; }
  icono(modulo: string): string { return ({ MENSUAL: 'fa-calendar-days', FEDERAL: 'fa-landmark', SEMANAL: 'fa-calendar-week', BANCI: 'fa-database' } as Record<string, string>)[modulo] ?? 'fa-gears'; }
  guardar(): void {
    const cambio = this.cambio();
    if (!cambio || this.guardando() || !this.motivoValido()) return;
    this.guardando.set(true); this.error.set('');
    const { titulo, idUsuario, ...request } = cambio;
    const payload = { ...request, motivo: this.motivo.trim() || 'Sin motivo reportado' };
    const operacion = idUsuario === undefined ? this.servicio.cambiar(payload) : this.servicio.cambiarAdministrador(idUsuario, { habilitado: payload.habilitado, versionEsperada: payload.versionEsperada, motivo: payload.motivo });
    operacion.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.guardando.set(false); this.cambio.set(null); this.exito.set('Configuración guardada. Las próximas operaciones usarán las reglas actuales.');
        this.cargar(); this.pagina.set(1); this.cargarHistorial(); this.cargarAdministradores();
        this.servicio.refrescarSesion().pipe(takeUntilDestroyed(this.destroy)).subscribe({ error: () => this.error.set('El cambio se guardó, pero no se pudieron refrescar sus accesos. Regrese a la selección de módulos para actualizarla.') });
      },
      error: e => { this.guardando.set(false); this.cambio.set(null); this.datos.set(null); this.administradores.set(null); this.error.set(obtenerMensajeErrorHttp(e, 'No se pudo confirmar el cambio. Actualice la configuración y revise la bitácora antes de intentarlo otra vez.')); }
    });
  }
  cargarAdministradores(): void {
    if (this.cargandoAdministradores() || this.guardando()) return;
    this.cargandoAdministradores.set(true); this.errorAdministradores.set('');
    this.servicio.administradores().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: datos => { this.administradores.set(datos); this.cargandoAdministradores.set(false); },
      error: e => { this.administradores.set(null); this.cargandoAdministradores.set(false); this.errorAdministradores.set(obtenerMensajeErrorHttp(e, 'No se pudieron consultar los superusuarios.')); }
    });
  }
  usuariosFiltrados(): SistemaAdministrador[] { const texto = this.buscarUsuario.trim().toLocaleLowerCase(); return (this.administradores()?.usuarios ?? []).filter(u => !texto || `${u.usuario} ${u.nombreCompleto}`.toLocaleLowerCase().includes(texto)); }
  prepararAdministrador(usuario: SistemaAdministrador): void {
    const datos = this.administradores();
    if (!datos || this.guardando() || this.cargandoAdministradores() || usuario.esActual) return;
    this.motivo = ''; this.error.set(''); this.exito.set('');
    this.cambio.set({ modulo: 'SISTEMA', clave: 'ADMINISTRADOR_ACCESO', habilitado: !usuario.habilitado, titulo: `acceso de ${usuario.usuario}`, versionEsperada: datos.version, motivo: '', idUsuario: usuario.idUsuario });
  }
  cargarHistorial(): void {
    if (this.cargandoHistorial()) return;
    this.cargandoHistorial.set(true); this.errorHistorial.set('');
    this.servicio.bitacora(this.pagina()).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: filas => { this.historial.set(filas); this.cargandoHistorial.set(false); },
      error: e => { this.cargandoHistorial.set(false); this.errorHistorial.set(obtenerMensajeErrorHttp(e, 'No se pudo consultar la bitácora.')); }
    });
  }
  moverPagina(delta: number): void { if (this.cargandoHistorial() || this.pagina() + delta < 1) return; this.pagina.update(p => p + delta); this.cargarHistorial(); }
  nombre(modulo: string): string { return ({ SISTEMA: 'Administración del sistema', MENSUAL: 'Consolidado', SEMANAL: 'Preliminar / Semanal', FEDERAL: 'Federal', BANCI: 'BANCI' } as Record<string, string>)[modulo] ?? modulo; }
  fechaUtc(valor: string): string { return /Z$|[+-]\d\d:\d\d$/.test(valor) ? valor : valor + 'Z'; }
}
