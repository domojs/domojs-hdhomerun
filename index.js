var debug=$('debug')('jnode:hdhomerun');
var hdhr=require('hdhomerun');
var channelscan=require('hdhomerun/examples/channelscan.js');
var devices=[];
var freeTuners={};
var streaming=$.tuners={};

hdhr.discover(function(err,res){
    if(err)
        debug(err);
    else
    {
        devices=devices.concat($.map(res, function(item){
            freeTuners[item.device_id]=[];
            var device=hdhr.create(item);
            for(var i=0;i<item.tuner_count;i++)
                freeTuners[item.device_id].push({device:device, name:'tuner'+i});
            return device; 
        }));
            
        var deviceForScan=Object.keys(freeTuners)[0];

        if(freeTuners && deviceForScan && freeTuners[deviceForScan].length>0)
        {
            debug('testing channel map existence');
            $('fs').exists('./channels.json', function(exists){
                if(!exists)
                {
                    debug('scanning started')
                    var channels=[];
                    var tunerForScan=freeTuners[deviceForScan].pop();
                    console.log('going to scan on '+tunerForScan.name+' (device:'+tunerForScan.device.device_id+')');
                    var scanner = channelscan.create(
                            {device: tunerForScan.device, first:21, tuner: tunerForScan.name.substring('tuner'.length)});
                    scanner.on('found', function (channel) {
                        var streaminfo=/^([0-9]+):\s([0-9]+)\s(([^ (\n]| [^(\n])+)( \(encrypted\))?$/mg;
                        var matches;
                    
                        while((matches=streaminfo.exec(channel.streaminfo)))
                        {
                            var index=Number(matches[2]);
                            if(index===0)
                                index=100;
                            channels[index]={name:matches[3], index:Number(matches[2]), channel:channel.status.match(/ch=[^:]+:([0-9]+)/)[1], program:matches[1], encrypted:typeof(matches[5])!='undefined'};
                        }
                    });
                    scanner.on('done', function (num_found) {
                            freeTuners[tunerForScan.device.device_id].push(tunerForScan);
                            debug('found %d channels', num_found);
                            debug('found %d programs', channels.length);

                            $('fs').writeFile('./channels.json', JSON.stringify(channels), function(err){
                                if(err) debug(err);
                                
                                registerDevices(channels);
                            });
                            
                

                    });
                    scanner.scan();
                }
                else
                {
                    registerDevices($('./channels.json'));
                }

            });
        }   
    }
});

function registerDevices(channels)
{
    //$.device({type:'pvr','name':'watch '+item.device_id,commands:
    //    $.extend.apply($, $.map($.grep(channels, function(item){ return item!==null }), function(item){
    //            var obj={};
    //            obj[item.name]='/api/tv/record/'+item.channel+'/'+item.program+'?returnUrl=udp://192.168.68.39:5000';
    //            return obj;
    //       }))
    //});
    $.each(freeTuners, function(device_id, tuners){
        var device={type:'hdhomerun','name':device_id, tuners:[]};
        var recordChannels=$.extend.apply($, $.map($.grep(channels, function(item){ return item!==null }), function(item){
            var obj={};
            obj[item.name]='/api/hdhomerun/record/'+device_id+'?channel='+item.channel+'&program='+item.program;
            return obj;
        }));
        console.log(recordChannels);

        Object.defineProperty(device, 'commands', {enumerable:true, get:function(){
            var commands={};
            $.each(this.tuners, function(index,tuner){
                if(tuner.isInUse)
                    commands['stop '+tuner.name]='/api/hdhomerun/stop/'+device_id+'?tuner='+tuner.name;
            });
            if(this.tuners.length>Object.keys(commands).length)
                return $.extend(commands, recordChannels);
            return commands;
        }});
        
        $.each(tuners, function(index, tuner){
            if(typeof(device.device)=='undefined')
                device.device=tuner.device;
            device.tuners.push({name:tuner.name, isInUse:false})
            
        })
        $.device(device);
    });
}

exports.init=function(config)
{
    if(config)
        $.settings('pvr', config);
    if(!$.settings('pvr.user'))
        $.settings('pvr.user', 'mediacenter');
    if(!$.settings('pvr.server'))
        $.settings('pvr.server', 'ana.dragon-angel.fr');
    if(!$.settings('pvr.path'))
        $.settings('pvr.path', '/media/ac685724-ead4-4ace-807b-36e6869f80d4/Videos');
};  