import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KpiService {

	datasets:object;

	constructor(
		private httpClient: HttpClient
	) {
		this.datasets = {
			"dashboard": {
				required: false,
				interval: 2500,
				api: '/dashboard',
				data: null,
				defaults: {
					last_blocks: {
						impeached: {
							'dashboard.health': 'day'
						},
						fees: {
							'dashboard.rewards': 'day'
						},
					},
					last_rewards: {
						total_roi: {
							'dashboard.top-teaser': 'year',
							'dashboard.rewards': 'year'
						},
						total_rewards: {
							'dashboard.rewards': 'day'
						},
						total_rewards_from_fixed: {
							'dashboard.rewards': 'day'
						},
						total_rewards_from_fee: {
							'dashboard.rewards': 'day'
						},
						total_reward_fixed_fee_ratio: {
							'dashboard.rewards': 'day'
						}
					},
					last_transactions: {
						count: {
							'dashboard.top-teaser': 'day',
							'dashboard.health': 'day'
						},
						volume: {
							'dashboard.health': 'day'
						},
						fee_avg: {
							'dashboard.health': 'day'
						}
					}
				},
				selections: {},
				options: {}
			},
			myrnode: {
				required: false,
				interval: 60000,
				api: '/rnode/user/$addr',
				data: null,
				defaults: {
					last_rewards: {
						total_mined: {
							'dashboard.myrnode': 'day'
						},
						total_impeached: {
							'dashboard.myrnode': 'day'
						},
						total_rewards: {
							'dashboard.myrnode': 'day'
						},
						total_roi: {
							'dashboard.myrnode': 'year'
						}
					},
					last_blocks: {
						impeached: {
							'dashboard.myrnode': 'day'
						}
					}
				},
				selections: {},
				options: {}
			}
		};
	}


	private async load (dataset, params) {
		let url = environment.backendBaseUrl + this.datasets[dataset].api;

		// inject params values
		Object.keys(params).forEach(k => url = url.replace(new RegExp('\\$'+k, 'i'), params[k]));

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				resolve(res)
			});
		});
	}
	isLoaded (dataset) {
		return !!this.datasets[dataset].data;
	}
	async require (dataset, params = {}) {
		if (this.datasets[dataset].required === false) {
			// immediatly load
			this.datasets[dataset].data = await this.load(dataset, params);

			this.datasets[dataset].required = setInterval(async () => {
				this.datasets[dataset].data = await this.load(dataset, params);
				this._initOptions(dataset);
			}, this.datasets[dataset].interval);
		}
	}
	unrequire (dataset) {
		if (this.datasets[dataset].required !== false) {
			clearInterval(this.datasets[dataset].required);
			this.datasets[dataset].required = false;
		}
	}
	data (dataset, kpi_key, subset, ui_key = null) {
		try {
			return this._data(dataset, kpi_key, subset, ui_key).data[subset];
		} catch (e) {
			return null;
		}
	}
	private _data (dataset, kpi_key, subset, ui_key = null) {
		let unit_selected;
		try {
			if (this.datasets[dataset].data[kpi_key].default)		// has default, just pass
				return this.datasets[dataset].data[kpi_key].default;

			// get default unit selection
			if (this.datasets[dataset].selections[kpi_key] && this.datasets[dataset].selections[kpi_key][subset] && this.datasets[dataset].selections[kpi_key][subset][ui_key])
				unit_selected = this.datasets[dataset].selections[kpi_key][subset][ui_key];
			else
				unit_selected = this.defaultUnit(dataset, kpi_key, subset, ui_key);
		} catch (e) {
			// no individual selection made yet, so we deliver default-selection
			unit_selected = this.defaultUnit(dataset, kpi_key, subset, ui_key);
		}
		return this.datasets[dataset].data[kpi_key][unit_selected];
	}
	defaultUnit (dataset, kpi_key, subset, ui_key) {
		this._initOptions(dataset);
		return this.datasets[dataset].defaults[kpi_key][subset][ui_key];
	}
	selectUnit (dataset, kpi_key, subset, ui_key, selected_unit) {
		if (!this.datasets[dataset].selections[kpi_key]) this.datasets[dataset].selections[kpi_key] = {};
		if (!this.datasets[dataset].selections[kpi_key][subset]) this.datasets[dataset].selections[kpi_key][subset] = {};
		if (!this.datasets[dataset].selections[kpi_key][subset][ui_key]) this.datasets[dataset].selections[kpi_key][subset][ui_key] = {};
		this.datasets[dataset].selections[kpi_key][subset][ui_key] = selected_unit;
	}
	selectedOption (dataset, kpi_key, subset, ui_key) {
		let unit = this.unitSelected(dataset, kpi_key, subset, ui_key);
		return this.datasets[dataset].options[kpi_key].filter(_ => _.unit == unit)[0];
	}
	unitSelected (dataset, kpi_key, subset, ui_key) {
		try {
			let sel = this.datasets[dataset].selections[kpi_key][subset][ui_key];

			if (!sel)
				return this.defaultUnit(dataset, kpi_key, subset, ui_key);

			return sel;
		} catch (e) {
			return this.defaultUnit(dataset, kpi_key, subset, ui_key);
		}
	}
	options (dataset, kpi_key) {
		return this.datasets[dataset].options[kpi_key];
	}
	private _initOptions (dataset) {
		Object.keys(this.datasets[dataset].defaults).forEach(kpi_key => {
			if (this.datasets[dataset].options[kpi_key])
				return;

			this.datasets[dataset].options[kpi_key] = Object.keys(this.datasets[dataset].data[kpi_key]).map(k => {
				return Object.assign({unit: k}, this.datasets[dataset].data[kpi_key][k].option);
			});
		});
	}
}
