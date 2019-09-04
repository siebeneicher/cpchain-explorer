import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ElementRef, Input } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../../pipes/convert-ts.pipe';
import { environment } from '../../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../../kpi.service';
import { LastBlockService } from '../../services/last-block.service';
import { SearchService } from '../../services/search.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-my-rnode',
  templateUrl: './my-rnode.component.html',
  styleUrls: ['./my-rnode.component.scss']
})
export class MyRnodeComponent implements OnInit {
	@Input() index:number;
	index_:number;
	address:string;
	user_rnodes:Array<any> = [];

	constructor(
		private httpClient: HttpClient,
		private router: Router,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService,
		public lastBlockService: LastBlockService,
		public searchService: SearchService,
		private elementRef: ElementRef
	) { }

	ngOnInit() {
		this.index_ = parseInt(this.index+"");
		setInterval(() => {
			this.updateUserRNode();
		}, 25);
	}

	updateUserRNode (remove = false) {
		this.user_rnodes = [];

		try {
			this.user_rnodes = <Array<any>> JSON.parse(this.cookieService.get(environment.dashboardUserRnodeFavorites));
		} catch (e) {
			this.cookieService.set(environment.dashboardUserRnodeFavorites, JSON.stringify([]));
		}

		// ADD
		if (!remove && this.address && !this.user_rnodes.includes(this.address)) {
			this.user_rnodes.push(this.address);
			this.cookieService.set(environment.dashboardUserRnodeFavorites, JSON.stringify(this.user_rnodes));
			this.kpi.require('myrnode', {addr: this.address}, this.address);
		}

		// RMOVE
		if (remove && this.address && this.user_rnodes.includes(this.address)) {
			this.user_rnodes.splice(this.user_rnodes.indexOf(this.address), 1);
			this.cookieService.set(environment.dashboardUserRnodeFavorites, JSON.stringify(this.user_rnodes));
			this.kpi.unrequire('myrnode', this.address);
			this.address = "";
		}

		const _i = this.index_;

		// INIT (WHEN ANOTHER RNODE HAS BEEN CHANGED)
		if (_i <= this.user_rnodes.length-1) {
			// ADD
			let n = this.user_rnodes[_i];
			if (this.address != n) {
				if (this.address) {
					// trigger removal first
					this.kpi.unrequire('myrnode', this.address);
					this.address = "";
				} else {
					// next tick we add
					this.address = this.user_rnodes[_i];
					this.kpi.require('myrnode', {addr: this.address}, this.address);
				}
			}
		} else if (this.address) {
			// REMOVE
			//this.kpi.unrequire('myrnode', this.address);
			this.address = "";
		}
	}

	resetUserRNode () {
		this.updateUserRNode(true);
	}

	addUserRNode () {
		let ele = document.querySelector('#address_input') as HTMLInputElement;
		if (ele) this.address = (ele.value+"").trim();
		this.updateUserRNode();
	}

	ngOnDestroy () {
		if (this.address)
this.kpi.unrequire('myrnode'/*, {addr: this.address}*/);
	}
}
