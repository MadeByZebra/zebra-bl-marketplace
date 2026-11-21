-- Zebra's Shop | protected public bootstrap | str-grinder
-- Contains NO commercial payload. Requires a paid, active personal license.
do
 local _e=(getgenv and getgenv()) or _G
 local _k=_e.ZebraLicense
 _e.ZebraLicense=nil
 if type(_k)~='string' or #_k~=60 or not string.match(_k,'^ZBL_[0-9a-f]+$') then
  error('Zebra license missing. Open Zebra\'s Shop > My Account > Generate loader.',0)
 end
 local _a={129,142,143,140,144,88,78,79,155,135,133,150,134,83,137,148,86,151,140,158,152,147,163,160,157,147,150,153,99,165,165,170,158,168,159,161,175,108,162,175,174,113,164,180,174,117,179,183,170,174,176,190,124,193,195,194,126,185,197,189,195,186,188,202,152,197,192,213,154}
 local _b={}
 for _i=1,#_a do _b[_i]=string.char((_a[_i]-24-_i)%256) end
 local _u=table.concat(_b).._k
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
