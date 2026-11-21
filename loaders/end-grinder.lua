-- Zebra's Shop | protected public bootstrap | end-grinder
-- Contains NO commercial payload. Requires a paid, active personal license.
do
 local _e=(getgenv and getgenv()) or _G
 local _k=_e.ZebraLicense
 _e.ZebraLicense=nil
 if type(_k)~='string' or #_k~=60 or not string.match(_k,'^ZBL_[0-9a-f]+$') then
  error('Zebra license missing. Open Zebra\'s Shop > My Account > Generate loader.',0)
 end
 local _a={140,153,154,151,155,99,89,90,166,146,144,161,145,94,148,159,97,162,151,169,163,158,174,171,168,158,161,164,110,176,176,181,169,179,170,172,186,119,173,186,185,124,175,191,185,128,190,194,181,185,187,201,135,190,200,191,137,196,208,200,206,197,199,213,163,208,203,224,165}
 local _b={}
 for _i=1,#_a do _b[_i]=string.char((_a[_i]-35-_i)%256) end
 local _u=table.concat(_b).._k
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
