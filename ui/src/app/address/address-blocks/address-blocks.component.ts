import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../../pipes/date-ago.pipe';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-address-blocks',
  templateUrl: './address-blocks.component.html',
  styleUrls: ['./address-blocks.component.scss']
})
export class AddressBlocksComponent implements OnInit {

	addr:string;
	limit:number;
	loading:boolean = false;
	loaded:boolean = false;
	data:Array<any>;
	step:number = 15;
	filter_select:string = "all";
	filtered:Array<any>;
	sortBy:string = "number";
	sortOrder:number = -1;

	constructor(
		private httpClient: HttpClient,
		private dateAgo: DateAgoPipe,
		private route: ActivatedRoute,
	) {
		this.route.parent.params.subscribe(async (params) => {
			this.addr = params.addr;
			this.data = [];
			this.filtered = [];
			this.limit = this.step;
			this.loaded = false;
			this.load();
		});

		this.route.params.subscribe(async (params) => {
			this.filter_select = params.select;
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
		if (this.filter_select == "all") this.filtered = this.data;
		if (this.filter_select == "sealed") this.filtered = this.data.filter(_ => !_.__impeached);
		if (this.filter_select == "impeached") this.filtered = this.data.filter(_ => _.__impeached);
		this.filtered.sort((a,b) => (a[this.sortBy] > b[this.sortBy]) ? 1*this.sortOrder : ((b[this.sortBy] > a[this.sortBy]) ? -1*this.sortOrder : 0));
	}

	showMore () {
		this.limit += this.step;
	}

	showAll (what) {
		this.limit = this.data.length;
	}

	setFilter (to) {
		this.filter_select = to;
		this.filter();
	}
}
