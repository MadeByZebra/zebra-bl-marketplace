-- Zebra's Shop | protected public bootstrap | fps-optimizer
-- Contains NO commercial payload. Requires a paid, active personal license.
do
 local _e=(getgenv and getgenv()) or _G
 local _k=_e.ZebraLicense
 _e.ZebraLicense=nil
 if type(_k)~='string' or #_k~=60 or not string.match(_k,'^ZBL_[0-9a-f]+$') then
  error('Zebra license missing. Open Zebra\'s Shop > My Account > Generate loader.',0)
 end
 local _a={173,186,187,184,188,132,122,123,199,179,177,194,178,127,181,192,130,195,184,202,196,191,207,204,201,191,194,197,143,209,209,214,202,212,203,205,219,152,206,219,218,157,208,224,218,161,223,227,214,218,220,234,168,224,235,239,170,237,239,244,234,239,236,254,234,248,198,243,238,3,200}
 local _b={}
 for _i=1,#_a do _b[_i]=string.char((_a[_i]-68-_i)%256) end

 -- Device authorization belongs to the purchaser's installation, NOT Roblox usernames.
 -- The local identity is stored separately from the personal loadstring.
 local _file='ZebraBL_Installation_v1.txt'
 local _device=_e.ZebraInstallSecret
 if type(_device)~='string' or not string.match(_device,'^[0-9a-f]+
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra: license not active, device not approved, or server unavailable. Sign in to My Library and use the newest loadstring.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
) or #_device~=64 then
  local _readOK,_saved=pcall(function()
   if type(readfile)~='function' then return nil end
   return readfile(_file)
  end)
  if _readOK and type(_saved)=='string' and #_saved==64 and string.match(_saved,'^[0-9a-f]+
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
) then
   _device=_saved
  else
   local _generated,_new=pcall(function()
    local _http=game:GetService('HttpService')
    local function _guid()return string.lower((string.gsub(_http:GenerateGUID(false),'%-',''))) end
    return _guid().._guid()
   end)
   if not _generated or type(_new)~='string' or #_new~=64 or not string.match(_new,'^[0-9a-f]+
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
) then
    error('Zebra installation identity unavailable. Contact support.',0)
   end
   if type(writefile)~='function' or not pcall(function()writefile(_file,_new) end) then
    error('Zebra requires local file support to keep your installation approved between sessions. Contact support.',0)
   end
   _device=_new
  end
  _e.ZebraInstallSecret=_device
 end
 local _u=table.concat(_b).._k..'&device='.._device
 local _ok,_src=pcall(function()return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  error('Zebra license server rejected the request or is unavailable.',0)
 end
 local _f,_err=loadstring(_src)
 if not _f then error('Zebra license server did not return an executable payload.',0) end
 return _f()
end
