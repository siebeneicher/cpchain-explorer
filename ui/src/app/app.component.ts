import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { fadeAnimation } from './animations'
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from "@angular/router";
import { environment } from '../environments/environment';
import { Router } from '@angular/router';

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
		private router: Router
	) {
	}

	ngOnInit() {
	}

	prepareRoute(outlet) {
		return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
	}

	search () {
		this.searchLoading = true;

		let input = <HTMLInputElement> document.querySelector('#app_search_input');
		let str = (input.value+"").trim();
		let url = environment.backendBaseUrl + '/search/' + str;
		input.value = "";

		this.httpClient.get(url).subscribe((data: any) => {
			this.searchLoading = false;

			if (data && data.type) {
				if (data.type == "address") {
					this.router.navigate(['/address', str]);
				} else if (data.type == "blockNumber") {
					this.router.navigate(['/block', str]);
				} else if (data.type == "hash") {
					this.router.navigate(['/trx', str]);
				}
// TODO:
				/* else if (data.type == "trxHash") {
					this.router.navigate(['/trx', str]);
				} else if (data.type == "blockHash") {
					this.router.navigate(['/block', data.blockNumber]);
				}*/
			} else {
// TODO:
			}
		});
	}
}
