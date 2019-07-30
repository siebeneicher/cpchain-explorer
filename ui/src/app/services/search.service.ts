import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SearchService {

	searchLoading:boolean = false;

  	constructor(
		private httpClient: HttpClient
	) { }

  	async search (term) {
		this.searchLoading = true;

		let str = (term+"").trim();
		let url = environment.backendBaseUrl + '/search/' + str;

		return new Promise((resolve) => {
			this.httpClient.get(url).subscribe((data: any) => {
				this.searchLoading = false;

				if (data && data.type) {
					if (data.type == "address") {
						resolve(['/address', str]);
					} else if (data.type == "blockNumber") {
						resolve(['/block', str]);
					} else if (data.type == "hash") {
						resolve(['/trx', str]);
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

				resolve(null);
			});
		});
  	}
}
