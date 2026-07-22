import { Routes } from '@angular/router';

import { ROLES } from './core/constants/roles.constants';
import { authGuard } from './core/guards/auth.guard';
import { cambioPasswordGuard } from './core/guards/cambio-password.guard';
import { cambioPasswordPendienteGuard } from './core/guards/cambio-password-pendiente.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { moduloGuard } from './core/guards/modulo.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'cambiar-password',
    loadComponent: () =>
      import('./pages/cambiar-password/cambiar-password').then((m) => m.CambiarPassword),
    canActivate: [authGuard, cambioPasswordPendienteGuard],
  },
  {
    path: 'seleccionar-modulo',
    loadComponent: () =>
      import('./pages/seleccionar-modulo/seleccionar-modulo').then((m) => m.SeleccionarModulo),
    canActivate: [authGuard, cambioPasswordGuard],
  },

  {
    path: 'semanal',
    loadComponent: () =>
      import('./layout/semanal-layout/semanal-layout').then((m) => m.SemanalLayout),
    canActivate: [authGuard, cambioPasswordGuard, moduloGuard],
    data: {
      modulo: 'SEMANAL',
    },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/semanal-inicio/semanal-inicio').then((m) => m.SemanalInicio),
      },
      {
        path: 'carga',
        loadComponent: () =>
          import('./pages/semanal-carga/semanal-carga').then((m) => m.SemanalCarga),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO, ROLES.ENLACE_ESTATAL],
          permiso: 'CARGA',
          tipoCarga: 'CARGA_INICIAL',
        },
      },
      {
        path: 'actualizacion',
        loadComponent: () =>
          import('./pages/semanal-carga/semanal-carga').then((m) => m.SemanalCarga),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO, ROLES.ENLACE_ESTATAL],
          permiso: 'MODIFICACION',
          tipoCarga: 'ACTUALIZACION',
        },
      },
      {
        path: 'administracion/cargas-pendientes',
        loadComponent: () =>
          import('./pages/semanal-aprobacion-cargas/semanal-aprobacion-cargas').then(
            (m) => m.SemanalAprobacionCargas,
          ),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
        },
      },
      {
        path: 'administracion/usuarios',
        loadComponent: () =>
          import('./pages/semanal-usuarios/semanal-usuarios').then((m) => m.SemanalUsuarios),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
        },
      },
      {
        path: 'administracion/delitos',
        loadComponent: () =>
          import('./pages/semanal-delitos/semanal-delitos').then((m) => m.SemanalDelitos),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
          permiso: 'ADMINISTRA_DELITOS',
        },
      },
    ],
  },

  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard, cambioPasswordGuard, moduloGuard],
    data: {
      modulo: 'MENSUAL',
    },
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },

      {
        path: 'carga-inicial',
        loadComponent: () =>
          import('./pages/carga-inicial/carga-inicial').then((m) => m.CargaInicial),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO, ROLES.ENLACE_ESTATAL],
          permiso: 'CARGA',
        },
      },

      {
        path: 'actualizacion',
        loadComponent: () =>
          import('./pages/actualizacion/actualizacion').then((m) => m.Actualizacion),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO, ROLES.ENLACE_ESTATAL],
          permiso: 'MODIFICACION',
        },
      },

      {
        path: 'informes',
        redirectTo: 'informes/envios',
      },

      {
        path: 'informes/envios',
        loadComponent: () => import('./pages/informes/informes').then((m) => m.Informes),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO, ROLES.ENLACE_ESTATAL, ROLES.CONSULTA],
          reporte: 'ENVIOS',
        },
      },

      {
        path: 'informes/cargas',
        loadComponent: () => import('./pages/informes/informes').then((m) => m.Informes),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
          reporte: 'CARGAS',
        },
      },

      {
        path: 'informes/originales',
        loadComponent: () => import('./pages/originales/originales').then((m) => m.Originales),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
        },
      },

      {
        path: 'informes/sabanas',
        loadComponent: () => import('./pages/informes/informes').then((m) => m.Informes),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO, ROLES.ENLACE_ESTATAL, ROLES.CONSULTA],
          reporte: 'SABANAS',
        },
      },

      {
        path: 'administracion/usuarios',
        loadComponent: () =>
          import('./pages/crud-registros/crud-registros').then((m) => m.CrudRegistros),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
        },
      },

      {
        path: 'administracion/configuracion',
        loadComponent: () =>
          import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
        },
      },

      {
        path: 'administracion/cargas-pendientes',
        loadComponent: () =>
          import('./pages/aprobacion-cargas/aprobacion-cargas').then((m) => m.AprobacionCargas),
        canActivate: [permissionGuard],
        data: {
          roles: [ROLES.SUPER_USUARIO],
        },
      },

      {
        path: 'crud-registros',
        redirectTo: 'administracion/usuarios',
      },
      {
        path: 'configuracion',
        redirectTo: 'administracion/configuracion',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
