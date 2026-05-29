import { Routes } from '@angular/router';

import { MainLayout } from './layout/main-layout/main-layout';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { CargaInicial } from './pages/carga-inicial/carga-inicial';
import { Actualizacion } from './pages/actualizacion/actualizacion';
import { DiferenciasActualizacion } from './pages/diferencias-actualizacion/diferencias-actualizacion';
import { Informes } from './pages/informes/informes';
import { CrudRegistros } from './pages/crud-registros/crud-registros';
import { Configuracion } from './pages/configuracion/configuracion';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: Login
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: Dashboard },

      {
        path: 'carga-inicial',
        component: CargaInicial,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO', 'ENLACE_ESTATAL'],
          permiso: 'CARGA'
        }
      },

      {
        path: 'actualizacion',
        component: Actualizacion,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO', 'ENLACE_ESTATAL'],
          permiso: 'MODIFICACION'
        }
      },

      {
        path: 'actualizacion/diferencias',
        component: DiferenciasActualizacion,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO', 'ENLACE_ESTATAL'],
          permiso: 'MODIFICACION'
        }
      },

      { path: 'informes', redirectTo: 'informes/envios' },

      {
        path: 'informes/envios',
        component: Informes,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO', 'ENLACE_ESTATAL', 'CONSULTA'],
          reporte: 'ENVIOS'
        }
      },

      {
        path: 'informes/cargas',
        component: Informes,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO'],
          reporte: 'CARGAS'
        }
      },

      {
        path: 'administracion/usuarios',
        component: CrudRegistros,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO']
        }
      },

      {
        path: 'administracion/configuracion',
        component: Configuracion,
        canActivate: [permissionGuard],
        data: {
          roles: ['SUPER_USUARIO']
        }
      },

      { path: 'crud-registros', redirectTo: 'administracion/usuarios' },
      { path: 'configuracion', redirectTo: 'administracion/configuracion' }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];