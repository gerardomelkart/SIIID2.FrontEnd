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
      { path: 'carga-inicial', component: CargaInicial },
      { path: 'actualizacion', component: Actualizacion },
      { path: 'actualizacion/diferencias', component: DiferenciasActualizacion },
      { path: 'informes', redirectTo: 'informes/envios' },
      { path: 'informes/envios', component: Informes, data: { reporte: 'ENVIOS' } },
      { path: 'informes/cargas', component: Informes, data: { reporte: 'CARGAS' } },

      // Nuevas rutas de administración
      { path: 'administracion/usuarios', component: CrudRegistros },
      { path: 'administracion/configuracion', component: Configuracion },

      // Rutas viejas redirigidas para no romper nada
      { path: 'crud-registros', redirectTo: 'administracion/usuarios' },
      { path: 'configuracion', redirectTo: 'administracion/configuracion' }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];