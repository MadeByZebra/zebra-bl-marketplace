-- Zebra's Shop | protected public bootstrap | dex-desktop
-- Contains NO commercial payload. Requires a paid, active personal license.
do
 local _e=(getgenv and getgenv()) or _G
 local _k=_e.ZebraLicense
 _e.ZebraLicense=nil
 if type(_k)~='string' or #_k~=60 or not string.match(_k,'^ZBL_[0-9a-f]+$') then
  error('Zebra license missing. Open Zebra\'s Shop > My Account > Generate loader.',0)
 end
 local _a={151,164,165,162,166,110,100,101,177,157,155,172,156,105,159,170,108,173,162,180,174,169,185,182,179,169,172,175,121,187,187,192,180,190,181,183,197,130,184,197,196,135,186,202,196,139,201,205,192,196,198,212,146,200,202,222,148,204,206,221,214,224,220,222,174,219,214,235,176}
 local _b={}
 for _i=1,#_a do _b[_i]=string.char((_a[_i]-46-_i)%256) end
 local _u=table.concat(_b).._k
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
