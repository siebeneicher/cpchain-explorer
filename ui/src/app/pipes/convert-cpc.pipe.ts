import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

@Pipe({
  name: 'convertCpc'
})
export class ConvertCpcPipe implements PipeTransform {

  transform(cpc: any): any {
	return cpc / environment.cpcConvert;
  }

}
