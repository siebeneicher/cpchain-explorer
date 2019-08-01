import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef, Input } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import * as moment from 'moment';

@Component({
  selector: 'app-blocks-squared',
  templateUrl: './blocks-squared.component.html',
  styleUrls: ['./blocks-squared.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlocksSquaredComponent implements OnInit {
	blocksByHour:Array<any>;
	blocksFlat:Array<any>;

	initiated:boolean = false;
	once_changed_by_user:boolean = false;

	@Input() unit:string;

	ts:number;
	mouse_x:number;
	mouse_y:number;
	hovered_block:any;
	hover_tooltip:any;
	loading:boolean = false;

	intervalId:any;

	//@ViewChild('hovertooltip') hovertooltip; 

	constructor(private httpClient: HttpClient, private ref: ChangeDetectorRef, private elementRef: ElementRef) { }

	ngOnInit() {
		// the timestamp needs to be the exact start of the day
		this.blocksByHour = [];
		this.blocksFlat = [];
		this.attachTooltipToDocument();

		this.setTsNow();

		// initial load
		this.loadBlocksSquared(false);

		this.intervalId = setInterval(() => {
			if (this.loading) return;
			this.loadBlocksSquared(false);
		}, 10000);

/*		setInterval(() => {
			const options = {
			  root: null,
			  rootMargin: '0px',
			  threshold: 1.0,
			  trackVisibility: true,
			  delay: 100
			}

			const observer = new IntersectionObserver((what) => {
				let box = what[0];
				if (box.isVisible) debugger;
			}, options);

			observer.observe(this.elementRef.nativeElement.querySelector('.initial-loading-placeholder'));
		}, 2000);*/
	}

	ngOnDestroy() {
		clearInterval(this.intervalId);
		this.destroyTooltip();
	}

	ngAfterViewInit () {

	}

	setTsNow () {
		if (this.unit == "day") {
			let today = moment.utc();
			today.second(0).minute(0).hour(0);
			this.ts = today.unix()*1000;
		}

		if (this.unit == "hour") {
			let curHour = moment.utc();
			curHour.second(0).minute(0);
			this.ts = curHour.unix()*1000;
		}
	}

/*	visible () {
		if (this.initiated) return;
		//this.loadBlocksSquared();
		setInterval(() => {
			this.loadBlocksSquared();
		}, 10000);
		this.initiated = true;
	}*/

	async loadBlocksSquared (changeByUser= false) {
		if (changeByUser) {		// show loading spinner only when date has been manually changed
			this.loading = true;
		} else if (!this.once_changed_by_user) {
			this.setTsNow();
		}

		const _this = this;
		const _ts_now = moment.utc().unix()*1000;
		let _emptyBlocks = this.blocksFlat.length == 0;

		this.httpClient.get(environment.backendBaseUrl+`/blocks-squared/${this.unit}/${this.ts}`).subscribe(async (res: any) => {
			if (_this.unit == "day") await _prepareDataByDay(res);
			if (_this.unit == "hour") await _prepareDataByHour(res);
			_this.loading = false;
			_this.initiated = true;
			_this.tick();
		});


		async function _prepareDataByHour (res) {
			if (changeByUser) {
				_this.blocksFlat.length = 0;
				_emptyBlocks = true;
			}

			for (let key = 0; key < res.length; key++) {
				_prepareBlock(res, key);
			}

			return Promise.resolve();
		}


		async function _prepareDataByDay (res) {
			const t = performance.now();

// TODO: make sure timestamp for res[0] and blocksByHour[0][0] is equal, otherwise discard this.blocksByHour

			// chunk processing to smooth cpu and rendering
			await _chunk(0, 1000);
			await _chunk(1001, 2000);
			await _chunk(2001, 3000);
			await _chunk(3001, 4000);
			await _chunk(4001, 5000);
			await _chunk(5001, 6000);
			await _chunk(6001, 7000);
			await _chunk(7001, res.length-1);

			_this.loading = false;

			async function _chunk (from, to) {
				return new Promise((resolve) => {
					if (changeByUser) {
						_this.blocksFlat.length = 0;
						_this.blocksByHour.length = 0;
						_emptyBlocks = true;
					}

					// chunk blocks and set state
					for (let key = from; key <= to; key++) {
						_prepareBlock(res, key);
					}

					//console.log("looped",performance.now()-t);
					_this.tick();
					//console.log("ticked:",performance.now()-t);

					resolve();
				});
			}
		}

		function _prepareBlock (res, key) {
			let b,h;

			b = _emptyBlocks ? res[key] : _this.blocksFlat[key];

			if (_emptyBlocks) {
				// optimize dom redraw
				b._trackID = b.timestamp;

				// chunk by hour
				h = moment.utc(b.timestamp).hour();

				// cluster by hour
				if (_this.unit == "day") {
					if (!_this.blocksByHour[h]) _this.blocksByHour.push([]);
					_this.blocksByHour[h].push(b);
				}

				_this.blocksFlat.push(b);			// keep reference easily accessable
			} else {
				Object.assign(b, res[key]);
			}

			// this is time relevant, so it should perform each block reload cycle
			// set sync_should on client side, as backend might not update properly in time
			b.sync_should = b.timestamp <= _ts_now;
		}
	}

	tick () {
		this.ref.markForCheck();
	}

	blocksTrackByFn(index, item) {
		return item._trackID;
	}

	sortNull () {}

	attachTooltipToDocument () {
		document.body.appendChild(document.querySelector("#hovertooltip"));
		this.hover_tooltip = document.querySelector("#hovertooltip");
	}

	destroyTooltip () {
		const ele = document.querySelector("#hovertooltip");
		ele.parentNode.removeChild(ele);
	}

	mousemove (h, $e) {
		this.mouse_x = $e.pageX, this.mouse_y = $e.pageY;

		if ($e.target.className.match(/block/) && h && h.key !== undefined) {
			let blockNum = $e.target.getAttribute('data-index');
			let block = this.blocksByHour[h.key][blockNum];
			if (block) {
				this.hover_tooltip.style.top = (this.mouse_y + 15) + 'px';
				this.hover_tooltip.style.left = (this.mouse_x + 15) + 'px';
				this.hovered_block = block;
			}
		}
	}

	mouseout () {
		setTimeout(() => {
			this.hovered_block = null;
		}, 2500);
	}

	backward () {
		this.once_changed_by_user = true;
		let mov = this.unit == "day" ? 24 : 1;
		this.ts = this.ts - 60*60*mov*1000;
		this.loadBlocksSquared(true);
	}

	forward () {
		this.once_changed_by_user = true;
		let mov = this.unit == "day" ? 24 : 1;
		this.ts = this.ts + 60*60*mov*1000;
		this.loadBlocksSquared(true);
	}
}
