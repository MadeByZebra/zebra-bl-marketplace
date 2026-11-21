-- Zebra's Shop | protected public bootstrap | dex-mobile
-- Contains NO commercial payload. Requires a paid, active personal license.
do
 local _e=(getgenv and getgenv()) or _G
 local _k=_e.ZebraLicense
 _e.ZebraLicense=nil
 if type(_k)~='string' or #_k~=60 or not string.match(_k,'^ZBL_[0-9a-f]+$') then
  error('Zebra license missing. Open Zebra\'s Shop > My Account > Generate loader.',0)
 end
 local _a={162,175,176,173,177,121,111,112,188,168,166,183,167,116,170,181,119,184,173,191,185,180,196,193,190,180,183,186,132,198,198,203,191,201,192,194,208,141,195,208,207,146,197,213,207,150,212,216,203,207,209,223,157,211,213,233,159,224,227,215,223,227,221,184,229,224,245,186}
 local _b={}
 for _i=1,#_a do _b[_i]=string.char((_a[_i]-57-_i)%256) end
 local _u=table.concat(_b).._k
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
