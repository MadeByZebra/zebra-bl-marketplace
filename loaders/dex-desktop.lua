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

 -- Optional black-and-white pairing card; the F9 code still works without it.
 local function _showActivation(_code)
  local _ok=pcall(function()
   local _player=game:GetService('Players').LocalPlayer
   if not _player then return end
   local _pg=_player:FindFirstChildOfClass('PlayerGui') or _player:WaitForChild('PlayerGui',3)
   if not _pg then return end
   local _old=_pg:FindFirstChild('ZebraBLActivation')
   if _old then _old:Destroy() end
   local _gui=Instance.new('ScreenGui')
   _gui.Name='ZebraBLActivation'
   _gui.ResetOnSpawn=false
   _gui.DisplayOrder=10000
   _gui.Parent=_pg
   local _card=Instance.new('Frame')
   _card.Name='ActivationCard'
   _card.Size=UDim2.new(0,350,0,211)
   _card.AnchorPoint=Vector2.new(.5,0)
   _card.Position=UDim2.new(.5,0,.14,-15)
   _card.BackgroundColor3=Color3.fromRGB(14,14,14)
   _card.BorderSizePixel=0
   _card.Parent=_gui
   local _corner=Instance.new('UICorner')
   _corner.CornerRadius=UDim.new(0,12)
   _corner.Parent=_card
   local _stroke=Instance.new('UIStroke')
   _stroke.Color=Color3.fromRGB(85,85,85)
   _stroke.Parent=_card
   local function _label(_txt,_top,_h,_size,_color,_font)
    local _v=Instance.new('TextLabel')
    _v.Size=UDim2.new(1,-36,0,_h)
    _v.Position=UDim2.new(0,18,0,_top)
    _v.BackgroundTransparency=1
    _v.Font=_font
    _v.TextSize=_size
    _v.TextColor3=_color
    _v.TextXAlignment=Enum.TextXAlignment.Left
    _v.TextWrapped=true
    _v.Text=_txt
    _v.Parent=_card
    return _v
   end
   local _white=Color3.fromRGB(245,245,245)
   local _gray=Color3.fromRGB(170,170,170)
   _label('BL SCRIPTS / ACTIVATE',14,25,16,_white,Enum.Font.GothamBold)
   _label('Approve this code in My Library',43,27,12,_gray,Enum.Font.Gotham)
   local _codeText=_label(_code,79,45,27,_white,Enum.Font.Code)
   _codeText.BackgroundTransparency=0
   _codeText.BackgroundColor3=Color3.fromRGB(4,4,4)
   _codeText.TextXAlignment=Enum.TextXAlignment.Center
   _label('Expires in 10 minutes. Closing this panel is safe.',129,26,11,_gray,Enum.Font.Gotham)
   local function _button(_name,_txt,_x,_w,_bg,_fg)
    local _b=Instance.new('TextButton')
    _b.Name=_name
    _b.Text=_txt
    _b.Size=UDim2.new(0,_w,0,32)
    _b.Position=UDim2.new(0,_x,0,167)
    _b.BackgroundColor3=_bg
    _b.TextColor3=_fg
    _b.Font=Enum.Font.GothamBold
    _b.TextSize=12
    _b.BorderSizePixel=0
    _b.Parent=_card
    local _round=Instance.new('UICorner')
    _round.CornerRadius=UDim.new(0,7)
    _round.Parent=_b
    return _b
   end
   local _copy=_button('CopyCode','COPY CODE',18,174,_white,Color3.fromRGB(10,10,10))
   local _close=_button('Dismiss','CLOSE',202,130,Color3.fromRGB(43,43,43),_white)
   _copy.MouseButton1Click:Connect(function()
    if type(setclipboard)=='function' and pcall(setclipboard,_code) then _copy.Text='COPIED'
    else _copy.Text='READ CODE ABOVE' end
   end)
   _close.MouseButton1Click:Connect(function() _gui:Destroy() end)
   pcall(function()
    game:GetService('TweenService'):Create(_card,
     TweenInfo.new(.26,Enum.EasingStyle.Quint,Enum.EasingDirection.Out),
     {Position=UDim2.new(.5,0,.14,0)}):Play()
   end)
  end)
  if not _ok then _notice('On-screen panel unavailable. Check F9 Client log or executor output.') end
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
   _showActivation(_code)
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
