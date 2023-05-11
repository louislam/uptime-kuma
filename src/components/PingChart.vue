<template>
    <div>
        <div class="period-options">
            <button type="button" class="btn btn-light dropdown-toggle btn-period-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                {{ chartPeriodOptions[chartPeriodHrs] }}&nbsp;
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li v-for="(item, key) in chartPeriodOptions" :key="key">
                    <a class="dropdown-item" :class="{ active: chartPeriodHrs == key }" href="#" @click="chartPeriodHrs = key">{{ item }}</a>
                </li>
            </ul>
        </div>
        <div class="chart-wrapper" :class="{ loading : loading}">
            <Line :data="chartData" :options="chartOptions" />
        </div>
    </div>
</template>

<script lang="js">
import { BarController, BarElement, Chart, Filler, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
import "chartjs-adapter-dayjs-4";
import dayjs from "dayjs";
import { Line } from "vue-chartjs";
import { useToast } from "vue-toastification";
import { DOWN, PENDING, MAINTENANCE, log } from "../util.ts";

const toast = useToast();

Chart.register(LineController, BarController, LineElement, PointElement, TimeScale, BarElement, LinearScale, Tooltip, Filler);


<iframe src="https://logs-stage-lax.dexguru.biz/app/dashboards#/view/4be240d0-2ee9-11ed-8e35-31a7df041d80?embed=true&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-15m,to:now))&_a=(description:'',filters:!(),fullScreenMode:!f,options:(hidePanelTitles:!f,useMargins:!t),panels:!((embeddableConfig:(attributes:(references:!((id:apm_static_index_pattern_id,name:indexpattern-datasource-current-indexpattern,type:index-pattern),(id:apm_static_index_pattern_id,name:indexpattern-datasource-layer-53a8cc76-7900-4373-840f-a2b33a75b5e2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-0,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-1,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-3,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-4,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-5,type:index-pattern)),state:(datasourceStates:(indexpattern:(layers:('53a8cc76-7900-4373-840f-a2b33a75b5e2':(columnOrder:!(e36fae2f-244a-428b-a8b8-339b2d845176,fea4f965-bc89-46fc-8e60-2789a59e61ba,b534d903-a573-4d1f-93ba-31b4f694a3a1),columns:(b534d903-a573-4d1f-93ba-31b4f694a3a1:(customLabel:!t,dataType:number,isBucketed:!f,label:'Requests%20count',operationType:count,scale:ratio,sourceField:Records),e36fae2f-244a-428b-a8b8-339b2d845176:(dataType:string,isBucketed:!t,label:'Top%20values%20of%20transaction.name',operationType:terms,params:(missingBucket:!f,orderBy:(columnId:b534d903-a573-4d1f-93ba-31b4f694a3a1,type:column),orderDirection:desc,otherBucket:!t,size:5),scale:ordinal,sourceField:transaction.name),fea4f965-bc89-46fc-8e60-2789a59e61ba:(dataType:date,isBucketed:!t,label:'@timestamp',operationType:date_histogram,params:(interval:auto),scale:interval,sourceField:'@timestamp')),incompleteColumns:())))),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-0,key:transaction.type,negate:!f,params:(query:request),type:phrase),query:(match_phrase:(transaction.type:request))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-1,key:transaction.name,negate:!t,params:(query:'GET%20%2Fhealth_check'),type:phrase),query:(match_phrase:(transaction.name:'GET%20%2Fhealth_check'))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-2,key:processor.event,negate:!f,params:(query:transaction),type:phrase),query:(match_phrase:(processor.event:transaction))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-3,key:service.environment,negate:!f,params:(query:prod),type:phrase),query:(match_phrase:(service.environment:prod))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-4,key:service.name,negate:!f,params:(query:auth-api),type:phrase),query:(match_phrase:(service.name:auth-api))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-5,key:http.request.method,negate:!t,params:(query:OPTIONS),type:phrase),query:(match_phrase:(http.request.method:OPTIONS)))),query:(language:kuery,query:''),visualization:(layers:!((accessors:!(b534d903-a573-4d1f-93ba-31b4f694a3a1),layerId:'53a8cc76-7900-4373-840f-a2b33a75b5e2',layerType:data,position:top,seriesType:bar_stacked,showGridlines:!f,splitAccessor:e36fae2f-244a-428b-a8b8-339b2d845176,xAccessor:fea4f965-bc89-46fc-8e60-2789a59e61ba)),legend:(isVisible:!t,position:right),preferredSeriesType:bar_stacked,title:'Empty%20XY%20chart',valueLabels:hide,yLeftExtent:(mode:full),yRightExtent:(mode:full))),title:'',type:lens,visualizationType:lnsXY),enhancements:(),hidePanelTitles:!f),gridData:(h:15,i:'9da03869-d149-40f2-ba4a-e30ab82dc387',w:24,x:0,y:0),panelIndex:'9da03869-d149-40f2-ba4a-e30ab82dc387',title:Throughput,type:lens,version:'7.17.7'),(embeddableConfig:(attributes:(references:!((id:apm_static_index_pattern_id,name:indexpattern-datasource-current-indexpattern,type:index-pattern),(id:apm_static_index_pattern_id,name:indexpattern-datasource-layer-53a8cc76-7900-4373-840f-a2b33a75b5e2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-0,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-1,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-3,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-4,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-5,type:index-pattern)),state:(datasourceStates:(indexpattern:(layers:('53a8cc76-7900-4373-840f-a2b33a75b5e2':(columnOrder:!(fea4f965-bc89-46fc-8e60-2789a59e61ba,d5ec61d9-8102-4522-a4d1-870d7c740e7e,'5b4cf596-9ce2-4c44-b3c9-90f9c9766db4'),columns:('5b4cf596-9ce2-4c44-b3c9-90f9c9766db4':(customLabel:!t,dataType:number,isBucketed:!f,label:'Status%20Code',operationType:count,scale:ratio,sourceField:Records),d5ec61d9-8102-4522-a4d1-870d7c740e7e:(dataType:string,isBucketed:!t,label:Filters,operationType:filters,params:(filters:!((input:(language:kuery,query:'http.response.status_code%20%3E%3D%20200%20AND%20http.response.status_code%20%3C%20300'),label:'2xx%20-%20success'),(input:(language:kuery,query:'http.response.status_code%20%3E%3D%20300%20AND%20status_code%20%3C%20400'),label:'3xx%20-%20redirection'),(input:(language:kuery,query:'http.response.status_code%20:%20400'),label:'400%20-%20bad%20request'),(input:(language:kuery,query:'http.response.status_code%20:%20401'),label:'401%20-%20unauthorized'),(input:(language:kuery,query:'http.response.status_code%20:%20403'),label:'403%20-%20forbidden'),(input:(language:kuery,query:'http.response.status_code%20:%20422'),label:'422%20-%20unprocessable'),(input:(language:kuery,query:'http.response.status_code%20:%20429'),label:'429%20-%20too%20many%20requests'),(input:(language:kuery,query:'http.response.status_code%20%3E%20400%20AND%20http.response.status_code%20%3C%20500%20AND%20NOT%20http.response.status_code%20IN%20%5B400%20401%20403%20422%20429%20426%5D'),label:'4xx%20-%20other%20errors'),(input:(language:kuery,query:'http.response.status_code%20:%20426'),label:'426%20-%20custom%20error'),(input:(language:kuery,query:'http.response.status_code%20%3E%3D%20500'),label:'5xx%20-%20server%20errors'))),scale:ordinal),fea4f965-bc89-46fc-8e60-2789a59e61ba:(dataType:date,isBucketed:!t,label:'@timestamp',operationType:date_histogram,params:(interval:auto),scale:interval,sourceField:'@timestamp')),incompleteColumns:())))),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-0,key:transaction.type,negate:!f,params:(query:request),type:phrase),query:(match_phrase:(transaction.type:request))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-1,key:processor.event,negate:!f,params:(query:transaction),type:phrase),query:(match_phrase:(processor.event:transaction))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-2,key:service.name,negate:!f,params:(query:auth-api),type:phrase),query:(match_phrase:(service.name:auth-api))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-3,key:service.environment,negate:!f,params:(query:prod),type:phrase),query:(match_phrase:(service.environment:prod))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-4,key:transaction.name,negate:!t,params:(query:'GET%20%2Fhealth_check'),type:phrase),query:(match_phrase:(transaction.name:'GET%20%2Fhealth_check'))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-5,key:http.request.method,negate:!t,params:(query:OPTIONS),type:phrase),query:(match_phrase:(http.request.method:OPTIONS)))),query:(language:kuery,query:''),visualization:(axisTitlesVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),fittingFunction:None,gridlinesVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),layers:!((accessors:!('5b4cf596-9ce2-4c44-b3c9-90f9c9766db4'),layerId:'53a8cc76-7900-4373-840f-a2b33a75b5e2',layerType:data,palette:(name:status,type:palette),position:top,seriesType:bar_stacked,showGridlines:!f,splitAccessor:d5ec61d9-8102-4522-a4d1-870d7c740e7e,xAccessor:fea4f965-bc89-46fc-8e60-2789a59e61ba)),legend:(isVisible:!t,position:right),preferredSeriesType:bar_stacked,tickLabelsVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),valueLabels:hide,yLeftExtent:(mode:full),yRightExtent:(mode:full))),title:'',type:lens,visualizationType:lnsXY),enhancements:(),hidePanelTitles:!f),gridData:(h:15,i:d89b7ff4-5b6f-440a-8735-6c0ccacb731c,w:24,x:24,y:0),panelIndex:d89b7ff4-5b6f-440a-8735-6c0ccacb731c,title:'Response%20Statuses%20Codes',type:lens,version:'7.17.7'),(embeddableConfig:(attributes:(references:!((id:apm_static_index_pattern_id,name:indexpattern-datasource-current-indexpattern,type:index-pattern),(id:apm_static_index_pattern_id,name:indexpattern-datasource-layer-53a8cc76-7900-4373-840f-a2b33a75b5e2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-0,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-1,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-3,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-4,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-5,type:index-pattern)),state:(datasourceStates:(indexpattern:(layers:('53a8cc76-7900-4373-840f-a2b33a75b5e2':(columnOrder:!(fea4f965-bc89-46fc-8e60-2789a59e61ba,'3623debf-9781-4f48-a5dd-df5dd16579d2','0f69fee6-a1c2-4bd2-9629-99ee74cff22f'),columns:('0f69fee6-a1c2-4bd2-9629-99ee74cff22f':(customLabel:!t,dataType:number,isBucketed:!f,label:'microseconds%20(1M%3D1s),%2095p',operationType:percentile,params:(percentile:95),scale:ratio,sourceField:transaction.duration.us),'3623debf-9781-4f48-a5dd-df5dd16579d2':(dataType:string,isBucketed:!t,label:'Top%20values%20of%20transaction.name',operationType:terms,params:(missingBucket:!f,orderBy:(columnId:'0f69fee6-a1c2-4bd2-9629-99ee74cff22f',type:column),orderDirection:desc,otherBucket:!f,size:5),scale:ordinal,sourceField:transaction.name),fea4f965-bc89-46fc-8e60-2789a59e61ba:(dataType:date,isBucketed:!t,label:'@timestamp',operationType:date_histogram,params:(interval:auto),scale:interval,sourceField:'@timestamp')),incompleteColumns:())))),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-0,key:transaction.type,negate:!f,params:(query:request),type:phrase),query:(match_phrase:(transaction.type:request))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-1,key:processor.event,negate:!f,params:(query:transaction),type:phrase),query:(match_phrase:(processor.event:transaction))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-2,key:service.environment,negate:!f,params:(query:prod),type:phrase),query:(match_phrase:(service.environment:prod))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-3,key:service.name,negate:!f,params:(query:auth-api),type:phrase),query:(match_phrase:(service.name:auth-api))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-4,key:transaction.name,negate:!t,params:(query:'GET%20%2Fhealth_check'),type:phrase),query:(match_phrase:(transaction.name:'GET%20%2Fhealth_check'))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-5,key:http.request.method,negate:!t,params:(query:OPTIONS),type:phrase),query:(match_phrase:(http.request.method:OPTIONS)))),query:(language:kuery,query:''),visualization:(axisTitlesVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),fittingFunction:None,gridlinesVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),layers:!((accessors:!('0f69fee6-a1c2-4bd2-9629-99ee74cff22f'),layerId:'53a8cc76-7900-4373-840f-a2b33a75b5e2',layerType:data,palette:(name:default,type:palette),position:top,seriesType:line,showGridlines:!f,splitAccessor:'3623debf-9781-4f48-a5dd-df5dd16579d2',xAccessor:fea4f965-bc89-46fc-8e60-2789a59e61ba)),legend:(isVisible:!t,position:right),preferredSeriesType:line,tickLabelsVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),valueLabels:hide,yLeftExtent:(mode:full),yRightExtent:(mode:full))),title:'',type:lens,visualizationType:lnsXY),enhancements:(),hidePanelTitles:!f),gridData:(h:15,i:'95512401-d1c6-459d-8c75-596c05fbddcf',w:24,x:0,y:15),panelIndex:'95512401-d1c6-459d-8c75-596c05fbddcf',title:Latency,type:lens,version:'7.17.7'),(embeddableConfig:(attributes:(references:!((id:apm_static_index_pattern_id,name:indexpattern-datasource-current-indexpattern,type:index-pattern),(id:apm_static_index_pattern_id,name:indexpattern-datasource-layer-53a8cc76-7900-4373-840f-a2b33a75b5e2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-0,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-1,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-2,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-3,type:index-pattern)),state:(datasourceStates:(indexpattern:(layers:('53a8cc76-7900-4373-840f-a2b33a75b5e2':(columnOrder:!(fea4f965-bc89-46fc-8e60-2789a59e61ba,d5ec61d9-8102-4522-a4d1-870d7c740e7e,'5b4cf596-9ce2-4c44-b3c9-90f9c9766db4'),columns:('5b4cf596-9ce2-4c44-b3c9-90f9c9766db4':(customLabel:!t,dataType:number,isBucketed:!f,label:'Status%20Code',operationType:count,scale:ratio,sourceField:Records),d5ec61d9-8102-4522-a4d1-870d7c740e7e:(dataType:string,isBucketed:!t,label:Filters,operationType:filters,params:(filters:!((input:(language:kuery,query:'http.response.status_code%20:%20400'),label:'400%20-%20bad%20request'),(input:(language:kuery,query:'http.response.status_code%20:%20401'),label:'401%20-%20unauthorized'),(input:(language:kuery,query:'http.response.status_code%20:%20403'),label:'403%20-%20forbidden'),(input:(language:kuery,query:'http.response.status_code%20:%20422'),label:'422%20-%20unprocessable'),(input:(language:kuery,query:'http.response.status_code%20:%20429'),label:'429%20-%20too%20many%20requests'),(input:(language:kuery,query:'http.response.status_code%20%3E%20400%20AND%20http.response.status_code%20%3C%20500%20AND%20NOT%20http.response.status_code%20IN%20%5B400%20401%20403%20422%20429%20426%5D'),label:'4xx%20-%20other%20errors'),(input:(language:kuery,query:'http.response.status_code%20:%20426'),label:'426%20-%20custom%20error'),(input:(language:kuery,query:'http.response.status_code%20%3E%3D%20500'),label:'5xx%20-%20server%20errors'))),scale:ordinal),fea4f965-bc89-46fc-8e60-2789a59e61ba:(dataType:date,isBucketed:!t,label:'@timestamp',operationType:date_histogram,params:(interval:auto),scale:interval,sourceField:'@timestamp')),incompleteColumns:())))),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-0,key:transaction.type,negate:!f,params:(query:request),type:phrase),query:(match_phrase:(transaction.type:request))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-1,key:processor.event,negate:!f,params:(query:transaction),type:phrase),query:(match_phrase:(processor.event:transaction))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-2,key:service.name,negate:!f,params:(query:auth-api),type:phrase),query:(match_phrase:(service.name:auth-api))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-3,key:service.environment,negate:!f,params:(query:prod),type:phrase),query:(match_phrase:(service.environment:prod)))),query:(language:kuery,query:''),visualization:(axisTitlesVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),fittingFunction:None,gridlinesVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),layers:!((accessors:!('5b4cf596-9ce2-4c44-b3c9-90f9c9766db4'),layerId:'53a8cc76-7900-4373-840f-a2b33a75b5e2',layerType:data,palette:(name:default,type:palette),position:top,seriesType:bar_stacked,showGridlines:!f,splitAccessor:d5ec61d9-8102-4522-a4d1-870d7c740e7e,xAccessor:fea4f965-bc89-46fc-8e60-2789a59e61ba)),legend:(isVisible:!t,position:right),preferredSeriesType:bar_stacked,tickLabelsVisibilitySettings:(x:!t,yLeft:!t,yRight:!t),valueLabels:hide,yLeftExtent:(mode:full),yRightExtent:(mode:full))),title:'',type:lens,visualizationType:lnsXY),enhancements:(),hidePanelTitles:!f),gridData:(h:15,i:'9645adb3-5077-47b4-a64a-a2d14496b62e',w:24,x:24,y:15),panelIndex:'9645adb3-5077-47b4-a64a-a2d14496b62e',title:'Failed%20Requests',type:lens,version:'7.17.7'),(embeddableConfig:(attributes:(references:!((id:'78ccf640-2a97-11ed-82ff-e1d6756231da',name:indexpattern-datasource-current-indexpattern,type:index-pattern),(id:'78ccf640-2a97-11ed-82ff-e1d6756231da',name:indexpattern-datasource-layer-028f2c1e-3e7b-4d35-beff-a8cd1c502830,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-0,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-1,type:index-pattern)),state:(datasourceStates:(indexpattern:(layers:('028f2c1e-3e7b-4d35-beff-a8cd1c502830':(columnOrder:!(e347b31d-07ea-46fb-b7ec-e2de6741259d,'9e0d9c8b-f47e-4124-9887-07cfcd8a031f','79d2ebf0-3f33-4518-b73d-f0138bef2125'),columns:('79d2ebf0-3f33-4518-b73d-f0138bef2125':(customLabel:!t,dataType:number,isBucketed:!f,label:Count,operationType:count,scale:ratio,sourceField:Records),'9e0d9c8b-f47e-4124-9887-07cfcd8a031f':(customLabel:!t,dataType:string,isBucketed:!t,label:'Top%20function%20names',operationType:terms,params:(missingBucket:!f,orderBy:(columnId:'79d2ebf0-3f33-4518-b73d-f0138bef2125',type:column),orderDirection:desc,otherBucket:!t,size:5),scale:ordinal,sourceField:funcName.keyword),e347b31d-07ea-46fb-b7ec-e2de6741259d:(dataType:string,isBucketed:!t,label:'Top%20values%20of%20module.keyword',operationType:terms,params:(missingBucket:!f,orderBy:(columnId:'79d2ebf0-3f33-4518-b73d-f0138bef2125',type:column),orderDirection:desc,otherBucket:!t,size:5),scale:ordinal,sourceField:module.keyword)),incompleteColumns:())))),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-0,key:levelname.keyword,negate:!f,params:(query:ERROR),type:phrase),query:(match_phrase:(levelname.keyword:ERROR))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-1,key:elasticapm_labels.service.name.keyword,negate:!f,params:(query:auth-api),type:phrase),query:(match_phrase:(elasticapm_labels.service.name.keyword:auth-api)))),query:(language:kuery,query:''),visualization:(layers:!((accessors:!('79d2ebf0-3f33-4518-b73d-f0138bef2125'),layerId:'028f2c1e-3e7b-4d35-beff-a8cd1c502830',layerType:data,position:top,seriesType:bar_stacked,showGridlines:!f,splitAccessor:'9e0d9c8b-f47e-4124-9887-07cfcd8a031f',xAccessor:e347b31d-07ea-46fb-b7ec-e2de6741259d)),legend:(isVisible:!t,position:right),preferredSeriesType:bar_stacked,title:'Empty%20XY%20chart',valueLabels:hide,yLeftExtent:(mode:full),yRightExtent:(mode:full))),title:'',type:lens,visualizationType:lnsXY),enhancements:(),hidePanelTitles:!f),gridData:(h:15,i:f08dc5dc-146e-4d61-b332-64f8a032dd35,w:24,x:24,y:30),panelIndex:f08dc5dc-146e-4d61-b332-64f8a032dd35,title:'Logged%20errors',type:lens,version:'7.17.7'),(embeddableConfig:(attributes:(references:!((id:'78ccf640-2a97-11ed-82ff-e1d6756231da',name:indexpattern-datasource-current-indexpattern,type:index-pattern),(id:'78ccf640-2a97-11ed-82ff-e1d6756231da',name:indexpattern-datasource-layer-028f2c1e-3e7b-4d35-beff-a8cd1c502830,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-0,type:index-pattern),(id:apm_static_index_pattern_id,name:filter-index-pattern-1,type:index-pattern)),state:(datasourceStates:(indexpattern:(layers:('028f2c1e-3e7b-4d35-beff-a8cd1c502830':(columnOrder:!(e347b31d-07ea-46fb-b7ec-e2de6741259d,'9e0d9c8b-f47e-4124-9887-07cfcd8a031f','79d2ebf0-3f33-4518-b73d-f0138bef2125'),columns:('79d2ebf0-3f33-4518-b73d-f0138bef2125':(customLabel:!t,dataType:number,isBucketed:!f,label:Count,operationType:count,scale:ratio,sourceField:Records),'9e0d9c8b-f47e-4124-9887-07cfcd8a031f':(customLabel:!t,dataType:string,isBucketed:!t,label:'Top%20function%20names',operationType:terms,params:(missingBucket:!f,orderBy:(columnId:'79d2ebf0-3f33-4518-b73d-f0138bef2125',type:column),orderDirection:desc,otherBucket:!t,size:5),scale:ordinal,sourceField:funcName.keyword),e347b31d-07ea-46fb-b7ec-e2de6741259d:(dataType:string,isBucketed:!t,label:'Top%20values%20of%20module.keyword',operationType:terms,params:(missingBucket:!f,orderBy:(columnId:'79d2ebf0-3f33-4518-b73d-f0138bef2125',type:column),orderDirection:desc,otherBucket:!t,size:5),scale:ordinal,sourceField:module.keyword)),incompleteColumns:())))),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-0,key:levelname.keyword,negate:!f,params:(query:WARNING),type:phrase),query:(match_phrase:(levelname.keyword:WARNING))),('$state':(store:appState),meta:(alias:!n,disabled:!f,indexRefName:filter-index-pattern-1,key:elasticapm_labels.service.name.keyword,negate:!f,params:(query:auth-api),type:phrase),query:(match_phrase:(elasticapm_labels.service.name.keyword:auth-api)))),query:(language:kuery,query:''),visualization:(layers:!((accessors:!('79d2ebf0-3f33-4518-b73d-f0138bef2125'),layerId:'028f2c1e-3e7b-4d35-beff-a8cd1c502830',layerType:data,position:top,seriesType:bar_stacked,showGridlines:!f,splitAccessor:'9e0d9c8b-f47e-4124-9887-07cfcd8a031f',xAccessor:e347b31d-07ea-46fb-b7ec-e2de6741259d)),legend:(isVisible:!t,position:right),preferredSeriesType:bar_stacked,title:'Empty%20XY%20chart',valueLabels:hide,yLeftExtent:(mode:full),yRightExtent:(mode:full))),title:'',type:lens,visualizationType:lnsXY),enhancements:(),hidePanelTitles:!f),gridData:(h:15,i:'8abd6f0f-a89d-47d2-9b9d-58ed9cba6b5e',w:24,x:0,y:30),panelIndex:'8abd6f0f-a89d-47d2-9b9d-58ed9cba6b5e',title:'Logged%20warnings',type:lens,version:'7.17.7')),query:(language:kuery,query:''),tags:!(),timeRestore:!f,title:'Auth%20API%20Overview',viewMode:view)" height="600" width="800"></iframe>


export default {
    components: { Line },
    props: {
        /** ID of monitor */
        monitorId: {
            type: Number,
            required: true,
        },
    },
    data() {
        return {

            loading: false,

            // Configurable filtering on top of the returned data
            chartPeriodHrs: 0,

            chartPeriodOptions: {
                0: this.$t("recent"),
                3: "3h",
                6: "6h",
                24: "24h",
                168: "1w",
            },

            // A heartbeatList for 3h, 6h, 24h, 1w
            // Uses the $root.heartbeatList when value is null
            heartbeatList: null
        };
    },
    computed: {
        chartOptions() {
            return {
                responsive: true,
                maintainAspectRatio: false,
                onResize: (chart) => {
                    chart.canvas.parentNode.style.position = "relative";
                    if (screen.width < 576) {
                        chart.canvas.parentNode.style.height = "275px";
                    } else if (screen.width < 768) {
                        chart.canvas.parentNode.style.height = "320px";
                    } else if (screen.width < 992) {
                        chart.canvas.parentNode.style.height = "300px";
                    } else {
                        chart.canvas.parentNode.style.height = "250px";
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 30,
                        top: 30,
                        bottom: 10,
                    },
                },

                elements: {
                    point: {
                        // Hide points on chart unless mouse-over
                        radius: 0,
                        hitRadius: 100,
                    },
                },
                scales: {
                    x: {
                        type: "time",
                        time: {
                            minUnit: "minute",
                            round: "second",
                            tooltipFormat: "YYYY-MM-DD HH:mm:ss",
                            displayFormats: {
                                minute: "HH:mm",
                                hour: "MM-DD HH:mm",
                            }
                        },
                        ticks: {
                            sampleSize: 3,
                            maxRotation: 0,
                            autoSkipPadding: 30,
                            padding: 3,
                        },
                        grid: {
                            color: this.$root.theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                            offset: false,
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.$t("respTime"),
                        },
                        offset: false,
                        grid: {
                            color: this.$root.theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                        },
                    },
                    y1: {
                        display: false,
                        position: "right",
                        grid: {
                            drawOnChartArea: false,
                        },
                        min: 0,
                        max: 1,
                        offset: false,
                    },
                },
                bounds: "ticks",
                plugins: {
                    tooltip: {
                        mode: "nearest",
                        intersect: false,
                        padding: 10,
                        backgroundColor: this.$root.theme === "light" ? "rgba(212,232,222,1.0)" : "rgba(32,42,38,1.0)",
                        bodyColor: this.$root.theme === "light" ? "rgba(12,12,18,1.0)" : "rgba(220,220,220,1.0)",
                        titleColor: this.$root.theme === "light" ? "rgba(12,12,18,1.0)" : "rgba(220,220,220,1.0)",
                        filter: function (tooltipItem) {
                            return tooltipItem.datasetIndex === 0;  // Hide tooltip on Bar Chart
                        },
                        callbacks: {
                            label: (context) => {
                                return ` ${new Intl.NumberFormat().format(context.parsed.y)} ms`;
                            },
                        }
                    },
                    legend: {
                        display: false,
                    },
                },
            };
        },
        chartData() {
            let pingData = [];  // Ping Data for Line Chart, y-axis contains ping time
            let downData = [];  // Down Data for Bar Chart, y-axis is 1 if target is down (red color), under maintenance (blue color) or pending (orange color), 0 if target is up
            let colorData = []; // Color Data for Bar Chart

            let heartbeatList = this.heartbeatList ||
             (this.monitorId in this.$root.heartbeatList && this.$root.heartbeatList[this.monitorId]) ||
             [];

            heartbeatList
                .filter(
                    // Filtering as data gets appended
                    // not the most efficient, but works for now
                    (beat) => dayjs.utc(beat.time).tz(this.$root.timezone).isAfter(
                        dayjs().subtract(Math.max(this.chartPeriodHrs, 6), "hours")
                    )
                )
                .map((beat) => {
                    const x = this.$root.datetime(beat.time);
                    pingData.push({
                        x,
                        y: beat.ping,
                    });
                    downData.push({
                        x,
                        y: (beat.status === DOWN || beat.status === MAINTENANCE || beat.status === PENDING) ? 1 : 0,
                    });
                    colorData.push((beat.status === MAINTENANCE) ? "rgba(23,71,245,0.41)" : ((beat.status === PENDING) ? "rgba(245,182,23,0.41)" : "#DC354568"));
                });

            return {
                datasets: [
                    {
                        // Line Chart
                        data: pingData,
                        fill: "origin",
                        tension: 0.2,
                        borderColor: "#5CDD8B",
                        backgroundColor: "#5CDD8B38",
                        yAxisID: "y",
                        label: "ping",
                    },
                    {
                        // Bar Chart
                        type: "bar",
                        data: downData,
                        borderColor: "#00000000",
                        backgroundColor: colorData,
                        yAxisID: "y1",
                        barThickness: "flex",
                        barPercentage: 1,
                        categoryPercentage: 1,
                        inflateAmount: 0.05,
                        label: "status",
                    },
                ],
            };
        },
    },
    watch: {
        // Update chart data when the selected chart period changes
        chartPeriodHrs: function (newPeriod) {

            // eslint-disable-next-line eqeqeq
            if (newPeriod == "0") {
                this.heartbeatList = null;
                this.$root.storage().removeItem(`chart-period-${this.monitorId}`);
            } else {
                this.loading = true;

                this.$root.getMonitorBeats(this.monitorId, newPeriod, (res) => {
                    if (!res.ok) {
                        toast.error(res.msg);
                    } else {
                        this.heartbeatList = res.data;
                        this.$root.storage()[`chart-period-${this.monitorId}`] = newPeriod;
                    }
                    this.loading = false;
                });
            }
        }
    },
    created() {
        // Setup Watcher on the root heartbeatList,
        // And mirror latest change to this.heartbeatList
        this.$watch(() => this.$root.heartbeatList[this.monitorId],
            (heartbeatList) => {

                log.debug("ping_chart", `this.chartPeriodHrs type ${typeof this.chartPeriodHrs}, value: ${this.chartPeriodHrs}`);

                // eslint-disable-next-line eqeqeq
                if (this.chartPeriodHrs != "0") {
                    const newBeat = heartbeatList.at(-1);
                    if (newBeat && dayjs.utc(newBeat.time) > dayjs.utc(this.heartbeatList.at(-1)?.time)) {
                        this.heartbeatList.push(heartbeatList.at(-1));
                    }
                }
            },
            { deep: true }
        );

        // Load chart period from storage if saved
        let period = this.$root.storage()[`chart-period-${this.monitorId}`];
        if (period != null) {
            this.chartPeriodHrs = Math.min(period, 6);
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.form-select {
    width: unset;
    display: inline-flex;
}

.period-options {
    padding: 0.1em 1em;
    margin-bottom: -1.2em;
    float: right;
    position: relative;
    z-index: 10;

    .dropdown-menu {
        padding: 0;
        min-width: 50px;
        font-size: 0.9em;

        .dark & {
            background: $dark-bg;
        }

        .dropdown-item {
            border-radius: 0.3rem;
            padding: 2px 16px 4px;

            .dark & {
                background: $dark-bg;
            }

            .dark &:hover {
                background: $dark-font-color;
                color: $dark-font-color2;
            }
        }

        .dark & .dropdown-item.active {
            background: $primary;
            color: $dark-font-color2;
        }
    }

    .btn-period-toggle {
        padding: 2px 15px;
        background: transparent;
        border: 0;
        color: $link-color;
        opacity: 0.7;
        font-size: 0.9em;

        &::after {
            vertical-align: 0.155em;
        }

        .dark & {
            color: $dark-font-color;
        }
    }
}

.chart-wrapper {
    margin-bottom: 0.5em;

    &.loading {
        filter: blur(10px);
    }
}
</style>
