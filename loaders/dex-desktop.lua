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


 -- One local installation may use multiple Roblox accounts; no Roblox ID binding.
 -- Never log the paid license or installation secret. Only the 10-char pairing code.
 local function _notice(_msg)
  local _line='[BL Scripts] '..tostring(_msg)
  if type(warn)=='function' then
   pcall(warn,_line)
  elseif type(print)=='function' then
   pcall(print,_line)
  end
  if type(rconsoleprint)=='function' then pcall(rconsoleprint,_line..'\n') end
 end
 local function _stop(_stage,_message)
  _notice(_stage..': '.._message)
  error('[BL Scripts] '.._stage..': '.._message,0)
 end
 if type(loadstring)~='function' then
  _stop('EXECUTOR','loadstring is not available in this executor.')
 end
 local function _valid(_v)
  return type(_v)=='string' and #_v==64 and string.match(_v,'^[a-f0-9]+$')~=nil
 end
 local _file='ZebraBL_Installation_v1.txt'
 local _device=_e.ZebraInstallSecret
 if not _valid(_device) then
  local _readOK,_saved=pcall(function()
   if type(readfile)~='function' then return nil end
   return readfile(_file)
  end)
  if _readOK and _valid(_saved) then
   _device=_saved
  else
   local _generated,_new=pcall(function()
    local _http=game:GetService('HttpService')
    local function _guid()
     return string.lower((string.gsub(_http:GenerateGUID(false),'%-','')))
    end
    return _guid().._guid()
   end)
   if not _generated or not _valid(_new) then
    _stop('INSTALLATION','Could not create a local identity. Contact Support.')
   end
   if type(writefile)~='function' or not pcall(function() writefile(_file,_new) end) then
    _stop('INSTALLATION','Executor file storage is required for device approval.')
   end
   _device=_new
  end
  _e.ZebraInstallSecret=_device
 end
 local _u=table.concat(_b).._k..'&device='.._device
 local _ok,_src=pcall(function() return game:HttpGet(_u,true) end)
 if not _ok or type(_src)~='string' or #_src==0 then
  _stop('NETWORK','Could not reach license server. Check your connection.')
 end
 local _fn,_compile=loadstring(_src)
 if type(_fn)~='function' then
  _stop('RESPONSE','Server returned non-executable content. Use the latest loader.')
 end
 local _ran,_result=pcall(_fn)
 if not _ran then
  local _message=tostring(_result)
  local _code=string.match(_message,'enter code%s+([0-9A-F]+)')
  if type(_code)=='string' and #_code==10 then
   _notice('ACTIVATION CODE: '.._code..' | Open My Library and approve installation.')
   pcall(function()
    game:GetService('StarterGui'):SetCore('SendNotification',{
     Title='BL Scripts activation',Text='Code: '.._code..' - approve in My Library',Duration=12
    })
   end)
  end
  _stop('LICENSE',_message)
 end
 _notice('Licensed script loaded on this installation.')
 return _result
end
