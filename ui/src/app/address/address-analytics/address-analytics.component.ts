import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../../pipes/date-ago.pipe';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-address-analytics',
  templateUrl: './address-analytics.component.html',
  styleUrls: ['./address-analytics.component.scss']
})
export class AddressAnalyticsComponent implements OnInit {

	addr:string;
	loading:boolean = false;
	loaded:boolean = false;
	data:Array<any>;
	filtered:Array<any>;

	constructor(
		private httpClient: HttpClient,
		private dateAgo: DateAgoPipe,
		private route: ActivatedRoute,
	) {
		this.route.parent.params.subscribe(async (params) => {
			this.addr = params.addr;
			this.data = [];
			this.filtered = [];
			this.loaded = false;
			this.load();
		});
	}

	ngOnInit() {
	}

	async load () {
		this.loading = true;
		let url = environment.backendBaseUrl + '/rnodes/blocks/' + this.addr;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: any) => {
				this.data = res ? <Array<any>> res : [];
				this.loading = false;
				this.loaded = true;
				this.filter();
				resolve();
			});
		});
	}

	filter () {
/*		if (this.filter_select == "all") this.filtered = this.data;
		if (this.filter_select == "sealed") this.filtered = this.data.filter(_ => !_.__impeached);
		if (this.filter_select == "impeached") this.filtered = this.data.filter(_ => _.__impeached);
		this.filtered.sort((a,b) => (a[this.sortBy] > b[this.sortBy]) ? 1*this.sortOrder : ((b[this.sortBy] > a[this.sortBy]) ? -1*this.sortOrder : 0));*/
	}

}
