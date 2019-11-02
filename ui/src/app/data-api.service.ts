import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class DataApiService {

	rnodesTimelines:any;
	rnodesTimelines_loading:any = null;
	ts_start:any = "latest";

	constructor(private httpClient: HttpClient) {

	}

	private loadRnodesTimelines () {
		if (this.rnodesTimelines_loading)
			return this.rnodesTimelines_loading;

		const f = {unit: "day", times: 7};
		const url = environment.backendBaseUrl + `/rnodes/timeline/${f.unit}/${f.times}/${this.ts_start}/ALL?fieldOnly=mined`;

		return this.rnodesTimelines_loading = new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: any) => {
				this.rnodesTimelines = res ? <Array<any>> res : {};
				this.rnodesTimelines_loading = null;
				resolve();
			});
		});
	}

	rnodeTimeline (addr) {
		return new Promise((resolve, reject) => {
			const _extract = (_addr) => {
				return this.rnodesTimelines.map(_ => Object.assign({ts: _.ts}, _.rnodes[addr]));
			}

			if (this.rnodesTimelines)
				return resolve(_extract(addr));

			this.loadRnodesTimelines().then(() => resolve(_extract(addr)));
		});
	}
}
