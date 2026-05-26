import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('SIIID2.FrontEnd');

  constructor(private router: Router) {}

  ngOnInit(): void {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    const esRecarga = navigationEntry?.type === 'reload';

    if (esRecarga) {
      this.router.navigateByUrl('/');
    }
  }
}