import { Routes } from '@angular/router';

import { MainLayout } from './layout/main-layout/main-layout';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { CargaInicial } from './pages/carga-inicial/carga-inicial';
import { Actualizacion } from './pages/actualizacion/actualizacion';
import { DiferenciasActualizacion } from './pages/diferencias-actualizacion/diferencias-actualizacion';
import { Informes } from './pages/informes/informes';
import { CrudRegistros } from './pages/crud-registros/crud-registros';

export const routes: Routes = [
  {
    path: 'login',
    component: Login
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: Dashboard },
      { path: 'carga-inicial', component: CargaInicial },
      { path: 'actualizacion', component: Actualizacion },
      { path: 'actualizacion/diferencias', component: DiferenciasActualizacion },
      { path: 'informes', component: Informes },
      { path: 'crud-registros', component: CrudRegistros }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];