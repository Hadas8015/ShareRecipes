// קומפוננטת דף הבית - Hero section, קולקציות, פיצ'רים ו-CTA

import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  /* אתחול הקומפוננטה - גלילה לראש העמוד בכל טעינה */
  ngOnInit(): void {
    window.scrollTo(0, 0);
  }
}
