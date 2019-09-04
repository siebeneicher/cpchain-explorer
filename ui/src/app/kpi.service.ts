import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KpiService {

	datasets:any;

	constructor(
		private httpClient: HttpClient
	) {
		this.datasets = {
			"dashboard": {
				required: {},
				interval: 2500,
				api: '/dashboard',
				data: {},
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
						avg_roi_year: {
							'dashboard.top-teaser': 'week',
							'dashboard.rewards': 'week'
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
				// different addresses require this kpi
				required: {},
				interval: 15000,
				api: '/rnode/user/$addr',
				data: {},
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
						avg_roi_year: {
							'dashboard.myrnode': 'week'
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
	isLoaded (dataset, key = "default") {
		return !!this.datasets[dataset].data[key];
	}
	async require (dataset, params = {}, key = "default") {
		if (this.datasets[dataset].required[key] === false || this.datasets[dataset].required[key] === undefined) {
			// immediatly load
			this.datasets[dataset].data[key] = await this.load(dataset, params);

			this.datasets[dataset].required[key] = setInterval(async () => {
				this.datasets[dataset].data[key] = await this.load(dataset, params);
				this.datasets[dataset].selections[key] = {};
				this.datasets[dataset].options[key] = {};
				this._initOptions(dataset);
			}, this.datasets[dataset].interval);
		}
	}
	unrequire (dataset, key = "default") {
		if (this.datasets[dataset].required[key] !== false && this.datasets[dataset].required[key] !== undefined) {
			clearInterval(this.datasets[dataset].required[key]);
			this.datasets[dataset].required[key] = false;
			this.datasets[dataset].data[key] = null;
		}
	}
	data (dataset, kpi_key, subset, ui_key = null, key = "default") {
		try {
			return this._data(dataset, kpi_key, subset, ui_key, key).data[subset];
		} catch (e) {
			return null;
		}
	}
	private _data (dataset, kpi_key, subset, ui_key = null, key = "default") {
		let unit_selected;
		try {
			if (this.datasets[dataset].data[key][kpi_key].default)		// has default, just pass
				return this.datasets[dataset].data[key][kpi_key].default;

			// get default unit selection
			if (this.datasets[dataset].selections[key][kpi_key] && this.datasets[dataset].selections[key][kpi_key][subset] && this.datasets[dataset].selections[key][kpi_key][subset][ui_key])
				unit_selected = this.datasets[dataset].selections[key][kpi_key][subset][ui_key];
			else
				unit_selected = this.defaultUnit(dataset, kpi_key, subset, ui_key, key);
		} catch (e) {
			// no individual selection made yet, so we deliver default-selection
			unit_selected = this.defaultUnit(dataset, kpi_key, subset, ui_key, key);
		}
		return this.datasets[dataset].data[key][kpi_key][unit_selected];
	}
	defaultUnit (dataset, kpi_key, subset, ui_key, key = "default") {
		this._initOptions(dataset, key);
		return this.datasets[dataset].defaults[kpi_key][subset][ui_key];
	}
	selectUnit (dataset, kpi_key, subset, ui_key, selected_unit, key = "default") {
		if (!this.datasets[dataset].selections[key][kpi_key]) this.datasets[dataset].selections[key][kpi_key] = {};
		if (!this.datasets[dataset].selections[key][kpi_key][subset]) this.datasets[dataset].selections[key][kpi_key][subset] = {};
		if (!this.datasets[dataset].selections[key][kpi_key][subset][ui_key]) this.datasets[dataset].selections[key][kpi_key][subset][ui_key] = {};
		this.datasets[dataset].selections[key][kpi_key][subset][ui_key] = selected_unit;
	}
	selectedOption (dataset, kpi_key, subset, ui_key, key = "default") {
		try {
			let unit = this.unitSelected(dataset, kpi_key, subset, ui_key, key);
			return this.datasets[dataset].options[key][kpi_key].filter(_ => _.unit == unit)[0];
		} catch (e) {
			return {};
		}
	}
	unitSelected (dataset, kpi_key, subset, ui_key, key = "default") {
		try {
			let sel = this.datasets[dataset].selections[key][kpi_key][subset][ui_key];

			if (!sel)
				return this.defaultUnit(dataset, kpi_key, subset, ui_key, key);

			return sel;
		} catch (e) {
			return this.defaultUnit(dataset, kpi_key, subset, ui_key, key);
		}
	}
	options (dataset, kpi_key, key = "default") {
		if (this.datasets[dataset].options[key] === undefined) this.datasets[dataset].options[key] = {};
		return this.datasets[dataset].options[key][kpi_key];
	}
	private _initOptions (dataset, key = "default") {
		try {
			Object.keys(this.datasets[dataset].defaults).forEach(kpi_key => {
				if (this.datasets[dataset].options[key][kpi_key])
					return;

				this.datasets[dataset].options[key][kpi_key] = Object.keys(this.datasets[dataset].data[key][kpi_key]).map(k => {
					return Object.assign({unit: k}, this.datasets[dataset].data[key][kpi_key][k].option);
				});
			});
		} catch (e) {
			// can trigger when data is late
		}
	}
}
