import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, NavigationStart, Scroll } from '@angular/router';
import { NavbarComponent } from '../comps/navbar/navbar.component';
import { FooterComponent } from '../comps/footer/footer.component';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NavbarComponent, FooterComponent],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App implements OnInit {
    title = 'recipe-project';

    constructor(
        private router: Router,
        private viewportScroller: ViewportScroller
    ) {}

    ngOnInit(): void {
        this.router.events.pipe(
            filter(event => event instanceof NavigationStart)
        ).subscribe(() => {
            this.scrollToTop();
        });

        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => {
            setTimeout(() => this.scrollToTop(), 0);
            setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }), 100);
        });

        this.router.events.pipe(
            filter((e): e is Scroll => e instanceof Scroll)
        ).subscribe(() => {
            this.viewportScroller.scrollToPosition([0, 0]);
        });
    }

    private scrollToTop(): void {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        this.viewportScroller.scrollToPosition([0, 0]);
    }
}