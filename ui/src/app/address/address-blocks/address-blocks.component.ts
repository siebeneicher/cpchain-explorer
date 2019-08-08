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

	constructor(
		private httpClient: HttpClient,
		private dateAgo: DateAgoPipe,
		private route: ActivatedRoute,
	) {
		this.route.parent.params.subscribe(async (params) => {
			this.addr = params.addr;
			this.data = [];
			this.limit = 15;
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
				resolve();
			});
		});
	}

	showMore () {
		this.limit += 15;
	}

	showAll (what) {
		this.limit = this.data.length;
	}
}
