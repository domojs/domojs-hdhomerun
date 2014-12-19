

module.exports={
    stop:function(device, tuner, callback){
        $.each(devices, function(index,item){
            if(item.device_id==req.params.device)
            {
                item.set('/'+req.params.tuner+'/target', 'none', function(err, ret)
                {
                    if($.grep(freeTuners[req.params.device], function(item){ return item.name==req.params.tuner}).length===0)
                        freeTuners[req.params.device].push({device:item,name:req.params.tuner });
                    else
                        debug('the tuner was not declared in use but was stopped anyway');
                    res.send(200);
                });
            }
        });      
    },
    tuners:function(callback){
        callback($.map(freeTuners, function(item,index){
            return {device:index, names:$.map(item, function(item){ return item.name; })};
        }));
    },
    record:function(id, channel, program, returnUrl, long, callback){
        var tuner;
        var devices=$.grep($.device().hdhomerun, function(item){ return item.name==id; });
        console.log(devices)
        var device=devices[0];
        var tuner=$.grep(device.tuners, function(index, tuner){
            return !tuner.isInUse || tuner.streamingTo==returnUrl;
        })[0];
        
        if(typeof(tuner)=='undefined')
            return next('Impossible de démarrer un enregistrement car aucun tuner n\'est disponible');

        tuner.isInUse=true;
        tuner.streamingTo=returnUrl;
            
        device.device.set('/'+tuner.name+'/target', 'none', function(err, ret)
        {
            device.device.set('/'+tuner.name+'/channel', 'auto:'+channel, function (err, ret) {
                if(err)
                    return next(err);
                    
                device.device.set('/'+tuner.name+'/program', program, function(err,ret){
    
                    if(!returnUrl)
                    {
                        var cmd="ssh "+$.settings('pvr.user')+"@"+$.settings('pvr.server')+" 'hdhomerun_config "+device.name+" save /"+tuner.name+" \""+$.settings('pvr.path')+"/"+tuner.name+"-"+Number(new Date())+".ts\" & pid=$!;sleep "+(long*60 || 10)+";kill $pid;wget http://home.dragon-angel.fr/api/tv/stop/"+device.name+"/"+tuner.name+" -O /dev/null'";
                        debug(cmd);
                        $('child_process').exec(cmd, function(error,stdout,stderr)
                        {
                            if(error)
                                debug(error);
                        });
                        res.send({device:device.name, tuner:tuner.name});
                    }
                    else
                        device.device.set('/'+tuner.name+'/target', returnUrl, function(err, ret)
                        {
                            if(err)
                            {
                                debug('unable to stream to '+returnUrl);
                                return next(err);
                            }
                            debug('now streaming to '+returnUrl);
                            streaming[returnUrl]=tuner;
                            res.send({device:tuner.device.device_id, tuner:tuner.name});
                        });
                });
            });
        });
    }
};