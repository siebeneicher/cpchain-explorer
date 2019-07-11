import { Component, OnInit } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { slideInAnimation } from './animations'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [ slideInAnimation ]
})
export class AppComponent implements OnInit {
	ngOnInit() {
	}

	prepareRoute(outlet) {
		return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
	}
}
