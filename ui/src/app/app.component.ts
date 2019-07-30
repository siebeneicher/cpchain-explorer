import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { fadeAnimation } from './animations'
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from "@angular/router";
import { environment } from '../environments/environment';
import { Router } from '@angular/router';
import { LastBlockService } from './services/last-block.service';
import { SearchService } from './services/search.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [ fadeAnimation ]
})
export class AppComponent implements OnInit {
	searchLoading:boolean = false;

	constructor (
		private httpClient: HttpClient,
		private route: ActivatedRoute,
		private router: Router,
		public lastBlockService: LastBlockService,
		public searchService: SearchService,
		private elementRef: ElementRef
	) {
	}

	ngOnInit() {
	}

	prepareRoute(outlet) {
		return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
	}

	async search () {
		let input = <HTMLInputElement> this.elementRef.nativeElement.querySelector('.app-search-input');
		let goTo = <Array<any>> await this.searchService.search(input.value);
		input.value = "";
		this.router.navigate(goTo);
	}
}
