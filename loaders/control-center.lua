-- Zebra's Shop | protected public bootstrap | control-center
-- Contains NO commercial payload. Requires a paid, active personal license.
do
 local _e=(getgenv and getgenv()) or _G
 local _k=_e.ZebraLicense
 _e.ZebraLicense=nil
 if type(_k)~='string' or #_k~=60 or not string.match(_k,'^ZBL_[0-9a-f]+$') then
  error('Zebra license missing. Open Zebra\'s Shop > My Account > Generate loader.',0)
 end
 local _a={118,131,132,129,133,77,67,68,144,124,122,139,123,72,126,137,75,140,129,147,141,136,152,149,146,136,139,142,88,154,154,159,147,157,148,150,164,97,151,164,163,102,153,169,163,106,168,172,159,163,165,179,113,166,179,179,186,185,183,181,119,174,177,187,194,180,194,144,189,184,205,146}
 local _b={}
 for _i=1,#_a do _b[_i]=string.char((_a[_i]-13-_i)%256) end
 local _u=table.concat(_b).._k
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
